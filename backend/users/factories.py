import factory
from django.contrib.auth import get_user_model

User = get_user_model()

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    # Sequence adds an incrementing number to make these unique
    username = factory.Sequence(lambda n: f'user_{n}')
    email = factory.Sequence(lambda n: f'user_{n}@astraea.com')
    
    # Standard password for all factory users
    password = factory.PostGenerationMethodCall('set_password', 'StrongPassword123!')