import logging
import threading
from datetime import datetime
from discord import SyncWebhook, Embed
from django.conf import settings

logger = logging.getLogger('django')


def send_msg_async(message: str, url: str, patch_status=None, report_details=None):
    """Sends the message async to the passed Discord webhook URL"""
    # Force report_details to default dictionary to avoid unpack exceptions
    if report_details is None:
        report_details = {}
        
    logger.info(f"[Discord Utils] Spawning execution thread for Discord type: '{patch_status}'")
    thread = threading.Thread(
        target=send_msg, 
        args=[message, url, patch_status, report_details], 
        daemon=True
    )
    thread.start()


def send_msg(message: str, url: str, patch_status=None, report_details=None):
    if not url:
        logger.error('[Discord Utils] Missing webhook URL')
        return False

    if report_details is None:
        report_details = {}

    try:
        webhook = SyncWebhook.from_url(url)
        normalized_status = str(patch_status).lower() if patch_status else ""
        category = report_details.get('category', 'patching')
        
        if category == 'update_check':
            embed = Embed(
                title="⚠️ Astraea Maintenance Required",
                description=message or report_details.get('msg', 'No summary details provided.'),
                color=0xf39c12,  # Orange/Warning
                timestamp=datetime.utcnow()
            )
            
            if normalized_status in ['outdated', 'out_of_date']:
                threshold = report_details.get('PATCH_THRESHOLD_DAYS', getattr(settings, 'PATCH_THRESHOLD_DAYS', 30))
                embed.description = (
                    f"Astraea has identified servers that have exceeded the **{threshold} day** patching threshold.\n\n"
                    f"{embed.description}"
                )

            embed.add_field(name="🖥️ Server", value=f"`{report_details.get('server_name', 'System Cluster')}`", inline=True)
            embed.add_field(name="⬇️ Current Version", value=f"`{report_details.get('current_version', 'Unknown')}`", inline=True)
            embed.add_field(name="⬆️ Target Version", value=f"`{report_details.get('target_version', 'Unknown')}`", inline=True)
            
            if report_details.get('download_url'):
                embed.add_field(name="🔗 URL", value=f"[Download/View Update]({report_details.get('download_url')})", inline=False)

        elif category == 'server_lifecycle':
            status_emoji = "⚙️"
            color = 0x3498db
            if 'delete' in normalized_status:
                status_emoji, color = "🗑️", 0xe74c3c
            elif 'add' in normalized_status:
                status_emoji, color = "✨", 0x2ecc71
            elif 'modify' in normalized_status:
                status_emoji, color = "📝", 0xf1c40f
                
            embed = Embed(
                title=f"{status_emoji} Astraea Server Lifecycle",
                description=message or report_details.get('msg', 'No summary details provided.'),
                color=color,
                timestamp=datetime.utcnow()
            )
            embed.add_field(name="🖥️ Server", value=f"`{report_details.get('server_name', 'System Cluster')}`", inline=True)
            embed.add_field(name="🛠️ Action", value=f"**{normalized_status.upper()}**", inline=True)
            embed.add_field(name="👤 Modified By", value=f"`{report_details.get('modified_by', 'System')}`", inline=True)

        else:
            color = 0x3498db  # Default: Info Blue
            status_emoji = "ℹ️"
            
            if normalized_status in ['failed', 'error', 'partial']: 
                color = 0xe74c3c  # Red
                status_emoji = "❌" if normalized_status != 'partial' else "⚠️"
            elif normalized_status in ['success', 'completed']: 
                color = 0x2ecc71  # Green
                status_emoji = "✅"
            elif normalized_status in ['warning', 'pending']:
                color = 0xf1c40f  # Yellow
                status_emoji = "⚠️"

            embed = Embed(
                title=f"{status_emoji} Astraea Patching Report",
                description=message or report_details.get('msg', 'No summary details provided.'),
                color=color,
                timestamp=datetime.utcnow()
            )

            embed.add_field(name="🖥️ Server", value=f"`{report_details.get('server_name', 'System Cluster')}`", inline=True)
            embed.add_field(name="📊 Status", value=f"**{normalized_status.upper()}**", inline=True)
            embed.add_field(name="📦 Packages Updated", value=f"`{report_details.get('updates_count', 0)}`", inline=True)
            embed.add_field(name="⏱️ Duration", value=f"`{report_details.get('duration', 'N/A')}`", inline=True)
            
            was_rebooted = report_details.get('was_rebooted', False)
            embed.add_field(name="♻️ System Rebooted", value="**🔄 Yes**" if was_rebooted else "**➖ No**", inline=True)

        embed.set_footer(text="Astraea Central Management Instance")
        webhook.send(embed=embed)

        if settings.DEBUG:
            logger.info(f'[Discord Utils] Routed and dispatched {normalized_status} alert (Category: {category})')
        
        return True
    except Exception as e:
        logger.error(f"[Discord Utils] Error executing webhook dispatch: {e}")
        return False