import logging
import threading
from datetime import datetime
from discord import SyncWebhook, Embed
from backend.settings import DEBUG, PATCH_THRESHOLD_DAYS

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

        # =================================================================
        # BRANCH A: OUTDATED MAINTENANCE LAYOUT
        # =================================================================
        if normalized_status == 'outdated':
            threshold = report_details.get('PATCH_THRESHOLD_DAYS', PATCH_THRESHOLD_DAYS)
            
            embed = Embed(
                title="⚠️ Maintenance Required",
                description=(
                    f"Astraea has identified servers that have exceeded the "
                    f"**{threshold} day** patching threshold.\n\n"
                    f"Please log in to the Astraea Dashboard to investigate."
                ),
                color=0x3498db,  # Alert Accent Blue
                timestamp=datetime.utcnow()
            )
            
            # Map the summary card box as a wide block field
            summary_text = message or report_details.get('msg', 'No summary details provided.')
            embed.add_field(
                name="📝 Summary",
                value=f"```text\n{summary_text}\n```",
                inline=False
            )

        # =================================================================
        # BRANCH B: STANDARD PATCH REPORT LAYOUT
        # =================================================================
        else:
            color = 0x3498db  # Default: Info Blue
            status_emoji = "ℹ️"
            
            if normalized_status in ['failed', 'error']: 
                color = 0xe74c3c  # Red
                status_emoji = "❌"
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

            # Inject Infrastructure Grid Columns
            embed.add_field(
                name="🖥️ Server", 
                value=f"`{report_details.get('server_name', 'System Cluster')}`", 
                inline=True
            )
            embed.add_field(
                name="📊 Status", 
                value=f"**{str(patch_status).upper()}**", 
                inline=True
            )
            embed.add_field(
                name="📦 Packages Updated", 
                value=f"`{report_details.get('updates_count', 0)}`", 
                inline=True
            )
            embed.add_field(
                name="⏱️ Duration", 
                value=f"`{report_details.get('duration', 'N/A')}`", 
                inline=True
            )

        # Global Footer Configuration
        embed.set_footer(text="Astraea Central Management Instance")
        webhook.send(embed=embed)

        if DEBUG:
            logger.info(f'[Discord Utils] Routed and dispatched {normalized_status} alert')
        
        return True
    except Exception as e:
        logger.error(f"[Discord Utils] Error executing webhook dispatch: {e}")
        return False