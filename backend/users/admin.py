from django.contrib import admin

from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    fields = ('last_login', 'is_superuser', 'first_name', 'last_name', 'is_staff', 'email', 'username', 'is_active')
    list_display = ('username',  'email', 'id', 'last_login', 'is_superuser', 'first_name', 'last_name', 'is_staff')
