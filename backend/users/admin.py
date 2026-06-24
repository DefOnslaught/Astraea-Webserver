from django.contrib import admin

from .models import User, Verification, ResetPassword

# Ensures the Django /admin/ page is only accessible to superusers
admin.site.has_permission = lambda request: request.user.is_active and request.user.is_superuser

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    fields = ('last_login', 'is_superuser', 'first_name', 'last_name', 'is_staff', 'email', 'username', 'is_active')
    list_display = ('username',  'email', 'id', 'last_login', 'is_superuser', 'first_name', 'last_name', 'is_staff')


@admin.register(Verification)
class VerificationAdmin(admin.ModelAdmin):
    fields = ('user', 'is_verified', 'resend_request', 'last_sent_at')
    list_display = ('token', 'user', 'is_verified', 'resend_request', 'last_sent_at')

@admin.register(ResetPassword)
class ResetPasswordAdmin(admin.ModelAdmin):
    fields = ('user', 'is_reset', 'resend_request', 'last_sent_at')
    list_display = ('token', 'user', 'is_reset', 'resend_request', 'last_sent_at')