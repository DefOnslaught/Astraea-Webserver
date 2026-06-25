import logging
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework.response import Response
from rest_framework import status

from .models import Verification

logger = logging.getLogger('django')
User = get_user_model()


def set_auth_cookies(response, access_token, refresh_token):
    """Helper to set tokens in HttpOnly cookies"""
    response.set_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE'],
        value=access_token,
        max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
        httponly=True,
        secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
        samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
    )
    response.set_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
        value=refresh_token,
        max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
        httponly=True,
        secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
        samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
    )
    return response


def return_login_response(user, message):
    """Helper to return the needed values when logging in"""
    return Response({
        'message': message,
        "user": {
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser
        }
    }, status=status.HTTP_200_OK)


def cacheVerificationStatus():
    """
    Stores all the user IDs and their 'is_verified' status
    """
    verifications = Verification.objects.all().values_list('user_id', 'is_verified')
    data = {f"verification_status:{user_id}": status for user_id, status in verifications}
    
    if data:
        cache.set_many(data, timeout=None)
        
    if settings.DEBUG:
        logger.info(f"Bulk cached {len(data)} verification statuses.")


def isUserVerified(user):
    """
    Checks if a user is verified, ensuring superusers always pass.
    """
    status = cache.get(f"verification_status:{user.id}")
    if status is not None:
        return status
    
    if user.is_superuser:
        return True

    try:
        v, created = Verification.objects.select_related('user').get_or_create(user_id=user.id)
    except Exception as e:
        logger.error(f"Error retrieving verification for user {user.id}: {e}")
        return False

    final_status = True if v.user.is_superuser else v.is_verified
    updateCacheVerificationStatus(user.id, final_status)
    return final_status


def updateCacheVerificationStatus(user_id, status):
    """
    Updates the cache record for the user.
    """
    cache.set(f"verification_status:{user_id}", status, timeout=None)
    if settings.DEBUG:
        logger.info(f"Cached verification status for user id `{user_id}`")


def removeCacheVerificationStatus(user_id):
    """
    Removes the specified user from the cache
    """
    cache.delete(f"verification_status:{user_id}")
    if settings.DEBUG:
        logger.info(f"Deleted cache for verification_status user id `{user_id}`")


def removeAllCacheVerificationStatus():
    """
    Properly removes all cached verification_status using wildcards.
    """
    if hasattr(cache, 'delete_pattern'):
        cache.delete_pattern("verification_status:*")
    else:
        keys = cache.keys("verification_status:*")
        if keys:
            cache.delete_many(keys)
            
    if settings.DEBUG:
        logger.info("Deleted all cached verification statuses.")