from django.urls import path

from .views import BasicUserInfoView, LogoutView

urlpatterns = [
    path('basic-user-info/', BasicUserInfoView.as_view(), name='basic-user-info'),
    path('logout/', LogoutView.as_view(), name='logout'),
]
