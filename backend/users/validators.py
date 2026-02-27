import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

class ComplexityValidator:
    def __init__(self, min_length=8):
        self.min_length = min_length

    def validate(self, password, user=None):
        if len(password) < self.min_length:
            raise ValidationError(
                _("This password must be at least %(min_length)d characters long."),
                code='password_too_short',
                params={'min_length': self.min_length},
            )
        
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("The password must contain at least one uppercase letter (A-Z)."),
                code='password_no_upper',    
            )
        
        if not re.search(r'[0-9]', password):
            raise ValidationError(
                _("The password must contain at least one number (0-9)."),
                code='password_no_number',
            )
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValidationError(
                _("The password must contain at least one symbol (!@#$%^&*...)."),
                code='password_no_symbol',
            )

    def get_help_text(self):
        return _(
            "Your password must contain at least 8 characters, one uppercase letter, one number, and one symbol."
        )