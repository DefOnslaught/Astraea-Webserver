import logging
import threading

from discord import SyncWebhook, Embed
from backend.settings import DEBUG

logger = logging.getLogger('django')


def send_msg_async(message: str, url: str, patch_status=None):
    """Sends the message async to the passed Discord webhook URL"""
    logger.info(f"[Discord Utils] Starting thread to send Discord message '{message}'")
    thread = threading.Thread(target=send_msg, args=[message, url, patch_status], daemon=True)
    thread.start()


def send_msg(message: str, url: str, patch_status=None):
    if not message or not url:
        logger.error('[Discord Utils] Missing message or URL')
        return False

    try:
        webhook = SyncWebhook.from_url(url)
        
        color = 0x3498db  # Default: Blue
        if patch_status == 'failed': 
            color = 0xe74c3c  # Red
        elif patch_status == 'success': 
            color = 0x2ecc71  # Green

        embed = Embed(
            title="Astraea System Notification",
            description=message,
            color=color
        )
        
        embed.set_footer(text="Astraea Central Management")

        webhook.send(embed=embed)

        if DEBUG:
            logger.info('[Discord Utils] Successfully sent notification')
        
        return True
    except Exception as e:
        logger.error(f"[Discord Utils] Error: {e}")
        return False