{{- define "beads-linear.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "beads-linear.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s" (include "beads-linear.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "beads-linear.labels" -}}
app.kubernetes.io/name: {{ include "beads-linear.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{- define "beads-linear.selectorLabels" -}}
app.kubernetes.io/name: {{ include "beads-linear.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "beads-linear.secretName" -}}
{{- if .Values.session.existingSecret -}}
{{- .Values.session.existingSecret -}}
{{- else -}}
{{- printf "%s-session" (include "beads-linear.fullname" .) -}}
{{- end -}}
{{- end -}}
