#!/usr/bin/env bash
# Run by the project owner in Google Cloud Shell. Never enables/links billing,
# creates keys, writes database data, or deploys application code/rules.
set -euo pipefail
project_id='october-challenge-2026'
repository='haagamble/October-challenge-2026'
pool_id='group-fit-github'
provider_id='github'
service_id='group-fit-scheduler'
role_id='groupFitScheduler'

repository_json="$(curl --fail --silent --show-error "https://api.github.com/repos/${repository}")"
repository_id="$(printf '%s' "$repository_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
owner_id="$(printf '%s' "$repository_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["owner"]["id"])')"
[[ "$repository_id" =~ ^[0-9]+$ && "$owner_id" =~ ^[0-9]+$ ]] || { echo 'Could not confirm GitHub identity.'; exit 1; }
project_number="$(gcloud projects describe "$project_id" --format='value(projectNumber)')"
[[ "$project_number" =~ ^[0-9]+$ ]] || { echo 'Could not confirm Google project.'; exit 1; }

if ! gcloud services enable iam.googleapis.com cloudresourcemanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$project_id"; then
  echo 'Stopped. No billing account was linked or enabled by this script.'
  echo 'If Google requires billing, do not upgrade. Return to the chat with that message.'
  exit 1
fi

service_email="${service_id}@${project_id}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$service_email" --project="$project_id" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$service_id" --display-name='Group Fit monthly scheduler' --project="$project_id"
fi
if gcloud iam roles describe "$role_id" --project="$project_id" >/dev/null 2>&1; then
  gcloud iam roles update "$role_id" --permissions=firebasedatabase.instances.get,firebasedatabase.instances.update --project="$project_id"
else
  gcloud iam roles create "$role_id" --title='Group Fit schedule data access' --permissions=firebasedatabase.instances.get,firebasedatabase.instances.update --stage=GA --project="$project_id"
fi
gcloud projects add-iam-policy-binding "$project_id" --member="serviceAccount:${service_email}" --role="projects/${project_id}/roles/${role_id}" --condition=None

if ! gcloud iam workload-identity-pools describe "$pool_id" --location=global --project="$project_id" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$pool_id" --location=global --display-name='Group Fit GitHub' --project="$project_id"
fi
mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id'
condition="assertion.repository_id == '${repository_id}' && assertion.repository_owner_id == '${owner_id}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${repository}/.github/workflows/cheerleaders.yml@refs/heads/main' && (assertion.event_name == 'schedule' || assertion.event_name == 'workflow_dispatch')"
if gcloud iam workload-identity-pools providers describe "$provider_id" --workload-identity-pool="$pool_id" --location=global --project="$project_id" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$provider_id" --workload-identity-pool="$pool_id" --location=global --issuer-uri=https://token.actions.githubusercontent.com --attribute-mapping="$mapping" --attribute-condition="$condition" --project="$project_id"
else
  gcloud iam workload-identity-pools providers create-oidc "$provider_id" --workload-identity-pool="$pool_id" --location=global --issuer-uri=https://token.actions.githubusercontent.com --attribute-mapping="$mapping" --attribute-condition="$condition" --project="$project_id"
fi
gcloud iam service-accounts add-iam-policy-binding "$service_email" --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/${project_number}/locations/global/workloadIdentityPools/${pool_id}/attribute.repository_id/${repository_id}" --project="$project_id"

printf '\nAdd these two non-secret GitHub Actions repository variables:\n'
printf 'GCP_WORKLOAD_IDENTITY_PROVIDER=projects/%s/locations/global/workloadIdentityPools/%s/providers/%s\n' "$project_number" "$pool_id" "$provider_id"
printf 'GCP_SCHEDULER_SERVICE_ACCOUNT=%s\n' "$service_email"
printf '\nNo private key was created. Firebase rules/data and the app were not deployed.\n'
