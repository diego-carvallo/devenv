#!/bin/bash

TRIGGER_NAMES=(
"alicia-build-and-deploy-DEPRECATED"
"backoffice-frontend-build"
"backoffice-pubsub-ws-bridge"
"clamav-malware-scanner"
"contentful-cache-build-and-deploy"
"furious-application-api"
"furious-backoffice-api"
"furious-communication-api"
"furious-dms-api"
"gcp-storage-bridge-build-and-deploy"
"maria-build-and-deploy"
"pubsub-api-bridge-build-and-deploy"
"rudderstack-service-build-and-deploy"
"seon-service-build-and-deploy"
"sms-service-build-and-deploy"
)

# Function to get the trigger ID by name
__get_trigger_id() {
    local trigger_name="$1"
    gcloud builds triggers list --filter="name=${trigger_name}" --format="value(id)"
}

# Function to update the trigger with new branch pattern and tags
__update_trigger() {
    local trigger_id="$1"
    local branch_pattern="$2"
    local tags=("$@")  # Remaining arguments are tags

    # Create a temporary file
    local tmpfile=$(mktemp)

    # Get the existing configuration
    gcloud builds triggers describe "$trigger_id" --format=yaml > "$tmpfile"

    # Update the branch pattern
    sed -i '' -e "s/branchName: .*/branchName: \"$branch_pattern\"/" "$tmpfile"

    # Check if tags section exists
    if grep -q "^tags:" "$tmpfile"; then
        # If tags section exists, add new tags if they are not already present
        for tag in "${tags[@]:2}"; do
            if ! grep -q "  - \"$tag\"" "$tmpfile"; then
                sed -i '' -e "/^tags:/a\\
  - \"$tag\"" "$tmpfile"
            fi
        done
    else
        # If tags section does not exist, add it at the end with proper formatting
        echo -e "\ntags:" >> "$tmpfile"
        for tag in "${tags[@]:2}"; do
            echo "  - \"$tag\"" >> "$tmpfile"
        done
    fi

    # Fix indentation issues that could corrupt the YAML structure
    awk 'BEGIN { in_tags = 0 } 
         /^tags:/ { in_tags = 1 }
         /^  -/ { if (in_tags) print; next }
         { in_tags = 0; print }' "$tmpfile" > "${tmpfile}.fixed" && mv "${tmpfile}.fixed" "$tmpfile"

    # Update the trigger with the modified configuration
    gcloud beta builds triggers import --source="$tmpfile"

    # Remove the temporary file
    rm "$tmpfile"
}

function _trigger_normalize() {
  echo "[devenv] Normalizing triggers"

    local branch_pattern="develop|^feature|^bugfix"

    for trigger_name in "${TRIGGER_NAMES[@]}"; do
        local trigger_id=$(__get_trigger_id "$trigger_name")

        if [[ -n "$trigger_id" ]]; then
            echo "Updating trigger: $trigger_name (ID: $trigger_id)"
            __update_trigger "$trigger_id" "$branch_pattern" "icash" "backend" "development"
        else
            echo "Trigger not found: $trigger_name"
        fi
    done

  echo "[devenv] Done normalizing"
}
function _trigger_list() {
#   echo "[devenv] _trigger_list"
    gcloud builds triggers list --project=development-brainfinance --sort-by=name --format="table(name,id,tags, triggerTemplate.branchName)"
#   echo "[devenv] Done _trigger_list"
}
