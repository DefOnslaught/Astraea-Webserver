import re
from django.shortcuts import render
from django.http import JsonResponse
from rest_framework import status

def frontend_view(request):
    # Define regex pattern to match /api/ or /*/api/
    api_pattern = r'^/api/|/.*/api/'

    # Check if request path matches the regex pattern
    # If matches, reject the url since it was intended for the backend
    if re.match(api_pattern, request.path):
        return JsonResponse({'message': 'Error - URL invalid'}, status=status.HTTP_404_NOT_FOUND)
    return render(request, 'index.html')