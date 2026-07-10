import os, logging
from django.conf import settings

logger = logging.getLogger('django')

def get_version():
        """Gets the version from version.txt, creating it with a baseline if it doesn't exist"""
        version_file = os.path.join(settings.BASE_DIR, "version.txt")

        if not os.path.exists(version_file):
            try:
                with open(version_file, "w") as f:
                    f.write("version=0.0.0\n")
            except Exception as e:
                logger.error(f"Failed to create version.txt, {str(e)}")
            return "0.0.0"

        try:
            with open(version_file, "r") as f:
                for line in f:
                    if line.strip().startswith("version="):
                        return line.strip().split("=", 1)[1].strip().strip("'").strip('"')
        except Exception as e:
            logger.error(f"Error reading version.txt, {str(e)}")
        
        return "0.0.0"


def normalize_version(v_string):
    """Strips 'v' prefix and handles None values for safe version comparison."""
    if not v_string:
        return "0.0.0"
    return str(v_string).lower().lstrip('v').strip()