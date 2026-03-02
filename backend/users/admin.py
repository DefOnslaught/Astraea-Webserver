from django.contrib import admin

from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    fields = ('id', 'last_login', 'is_superuser', 'first_name', 'last_name', 'is_staff', 'email', 'username')
    list_display = ('username',  'email', 'id', 'last_login', 'is_superuser', 'first_name', 'last_name', 'is_staff')
