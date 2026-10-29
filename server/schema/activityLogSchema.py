# Create a dictionary of a single Activity Log
def individual_activity_log(log) -> dict:
    return {
        "id": str(log["_id"]),
        "user_id": log.get("user_id", ""),
        "user_name": log.get("user_name", "Unknown account"),
        "user_type": log.get("user_type", ""),
        "role_label": log.get("role_label", ""),
        "entry": log.get("entry", "-"),
        "module": log.get("module", "-"),
        "ip_address": log.get("ip_address", ""),
        "created_at": str(log["created_at"]) if "created_at" in log.keys() else "",
    }

# Create a list of Activity Log dictionaries
def list_activity_logs(logs) -> list:
    return [individual_activity_log(log) for log in logs]
