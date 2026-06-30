from django.contrib import admin

from .models import ReportFilter, ReportRequest

@admin.register(ReportFilter)
class ReportFilterAdmin(admin.ModelAdmin):
    fields = ('user', 'name', 'description', 'is_public', 'is_global', 'criteria', 'selected_fields')
    list_display = ('id', 'user', 'name', 'description', 'is_public', 'is_global', 'criteria', 'selected_fields', 'created_at', 'updated_at')


@admin.register(ReportRequest)
class ReportRequestAdmin(admin.ModelAdmin):
    fields = ('user', 'file_name', 'report_filter', 'status', 'applied_criteria', 'selected_fields')
    list_display = ('id', 'user', 'file_name', 'report_filter', 'status', 'applied_criteria', 'selected_fields', 'created_at', 'updated_at')