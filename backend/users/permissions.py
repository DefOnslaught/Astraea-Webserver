


def checkIsStaff(user):
    """
    Returns the value of is_staff, is_superuser overrides
    """

    if user.is_superuser:
        return True
    
    return user.is_staff


def checkIfHigherPermissions(request, target_user):
    """
    Ensures members cannot modify users with 'is_superuser', must be equal
    """
    if target_user.is_superuser and not request.user.is_superuser:
        return True
    
    return False