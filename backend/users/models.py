import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class CustomUserManager(BaseUserManager):
    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, username, password, **extra_fields)

class User(AbstractUser):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=30, unique=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.username
    
class Verification(models.Model):
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="verification")
    is_verified = models.BooleanField(default=False, db_index=True)
    resend_request = models.PositiveIntegerField(default=0)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Verification"

class ResetPassword(models.Model):
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="passwordreset")
    is_reset = models.BooleanField(default=False)
    resend_request = models.PositiveIntegerField(default=0)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Reset Password"