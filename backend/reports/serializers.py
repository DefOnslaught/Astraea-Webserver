from rest_framework import serializers

from .models import ReportFilter, ReportRequest


class ReportFilterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportFilter
        fields = ['user', 'name', 'description', 'is_public', 'is_global', 'criteria', 'selected_fields']
        read_only_fields = ['id', 'user']


class ReportRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportRequest
        fields = ['id', 'user', 'file_name', 'report_filter', 'status', 'applied_criteria', 'selected_fields', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user']