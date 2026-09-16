"""Kind-scoped access to consolidated Disease Watch internal documents.

The four logical stores share one MongoDB collection.  This adapter makes the
document discriminator part of every supported operation and makes writes
retain it.  Callers receive ordinary PyMongo cursors and result objects.
"""
from copy import deepcopy


DESTINATION_COLLECTION = "disease_watch_internal"

REGIONAL_SUMMARY = "regional_summary"
SUMMARY_EVENT = "summary_event"
ALERT_BATCH_STATE = "alert_batch_state"
ALERT_COOLDOWN = "alert_cooldown"

DOCUMENT_KINDS = (
    REGIONAL_SUMMARY,
    SUMMARY_EVENT,
    ALERT_BATCH_STATE,
    ALERT_COOLDOWN,
)

SOURCE_COLLECTION_KINDS = {
    "regional_symptom_summaries": REGIONAL_SUMMARY,
    "regional_summary_events": SUMMARY_EVENT,
    "regional_alert_batch_states": ALERT_BATCH_STATE,
    "regional_alert_cooldowns": ALERT_COOLDOWN,
}


class KindScopedCollection:
    """A narrow PyMongo collection view that cannot cross document kinds."""

    def __init__(self, collection, kind):
        if kind not in DOCUMENT_KINDS:
            raise ValueError(f"Unsupported Disease Watch document kind: {kind}")
        self.collection = collection
        self.kind = kind

    def __bool__(self):
        # Match PyMongo Collection behavior so availability checks must use
        # ``is None`` rather than accidentally treating storage as a boolean.
        raise NotImplementedError("Collection objects do not implement truth value testing")

    def _filter(self, query=None):
        scoped = deepcopy(query or {})
        requested_kind = scoped.get("kind")
        if requested_kind is not None and requested_kind != self.kind:
            raise ValueError(f"Query kind {requested_kind!r} conflicts with scoped kind {self.kind!r}")
        scoped["kind"] = self.kind
        return scoped

    def _document(self, document):
        item = deepcopy(document)
        requested_kind = item.get("kind")
        if requested_kind is not None and requested_kind != self.kind:
            raise ValueError(f"Document kind {requested_kind!r} conflicts with scoped kind {self.kind!r}")
        item["kind"] = self.kind
        return item

    def _update(self, update):
        if not isinstance(update, dict) or not any(str(key).startswith("$") for key in update):
            raise ValueError("Scoped updates must use MongoDB update operators")
        item = deepcopy(update)
        for operator, values in item.items():
            if not isinstance(values, dict):
                continue
            if "kind" in values:
                requested_kind = values["kind"]
                if operator not in ("$set", "$setOnInsert") or requested_kind != self.kind:
                    raise ValueError(f"Update kind {requested_kind!r} conflicts with scoped kind {self.kind!r}")
                if operator == "$setOnInsert":
                    del values["kind"]
            if operator == "$rename" and "kind" in values.values():
                raise ValueError("An update cannot rename a field to the kind discriminator")
        item.setdefault("$set", {})["kind"] = self.kind
        if not item.get("$setOnInsert"):
            item.pop("$setOnInsert", None)
        return item

    def find(self, query=None, *args, **kwargs):
        return self.collection.find(self._filter(query), *args, **kwargs)

    def find_one(self, query=None, *args, **kwargs):
        return self.collection.find_one(self._filter(query), *args, **kwargs)

    def count_documents(self, query, *args, **kwargs):
        return self.collection.count_documents(self._filter(query), *args, **kwargs)

    def distinct(self, key, query=None, *args, **kwargs):
        return self.collection.distinct(key, self._filter(query), *args, **kwargs)

    def aggregate(self, pipeline, *args, **kwargs):
        stages = deepcopy(list(pipeline))
        if stages and "$geoNear" in stages[0]:
            geo_near = stages[0]["$geoNear"]
            geo_near["query"] = self._filter(geo_near.get("query"))
        else:
            stages.insert(0, {"$match": {"kind": self.kind}})
        return self.collection.aggregate(stages, *args, **kwargs)

    def insert_one(self, document, *args, **kwargs):
        return self.collection.insert_one(self._document(document), *args, **kwargs)

    def insert_many(self, documents, *args, **kwargs):
        return self.collection.insert_many([self._document(item) for item in documents], *args, **kwargs)

    def update_one(self, query, update, *args, **kwargs):
        return self.collection.update_one(self._filter(query), self._update(update), *args, **kwargs)

    def update_many(self, query, update, *args, **kwargs):
        return self.collection.update_many(self._filter(query), self._update(update), *args, **kwargs)

    def replace_one(self, query, replacement, *args, **kwargs):
        return self.collection.replace_one(self._filter(query), self._document(replacement), *args, **kwargs)

    def find_one_and_update(self, query, update, *args, **kwargs):
        return self.collection.find_one_and_update(self._filter(query), self._update(update), *args, **kwargs)

    def find_one_and_replace(self, query, replacement, *args, **kwargs):
        return self.collection.find_one_and_replace(self._filter(query), self._document(replacement), *args, **kwargs)

    def find_one_and_delete(self, query, *args, **kwargs):
        return self.collection.find_one_and_delete(self._filter(query), *args, **kwargs)

    def delete_one(self, query, *args, **kwargs):
        return self.collection.delete_one(self._filter(query), *args, **kwargs)

    def delete_many(self, query, *args, **kwargs):
        return self.collection.delete_many(self._filter(query), *args, **kwargs)


def scoped_collections(collection):
    """Return the four logical views over the approved destination."""
    return {
        REGIONAL_SUMMARY: KindScopedCollection(collection, REGIONAL_SUMMARY),
        SUMMARY_EVENT: KindScopedCollection(collection, SUMMARY_EVENT),
        ALERT_BATCH_STATE: KindScopedCollection(collection, ALERT_BATCH_STATE),
        ALERT_COOLDOWN: KindScopedCollection(collection, ALERT_COOLDOWN),
    }


def ensure_disease_watch_internal_indexes(collection):
    """Create discriminator-aware constraints and operational query indexes."""
    definitions = (
        ([("kind", 1), ("region", 1)], {
            "unique": True,
            "name": "unique_disease_watch_regional_summary",
            "partialFilterExpression": {"kind": REGIONAL_SUMMARY},
        }),
        ([("kind", 1), ("region", 1), ("reportId", 1)], {
            "unique": True,
            "name": "unique_disease_watch_summary_event",
            "partialFilterExpression": {"kind": SUMMARY_EVENT},
        }),
        ([("kind", 1), ("region", 1)], {
            "unique": True,
            "name": "unique_disease_watch_alert_batch_state",
            "partialFilterExpression": {"kind": ALERT_BATCH_STATE},
        }),
        ([("kind", 1), ("region", 1), ("symptomKey", 1)], {
            "unique": True,
            "name": "unique_disease_watch_alert_cooldown",
            "partialFilterExpression": {"kind": ALERT_COOLDOWN},
        }),
        ([("kind", 1), ("region", 1), ("consumedBatchId", 1), ("occurredAt", 1)], {
            "name": "disease_watch_active_summary_events",
            "partialFilterExpression": {"kind": SUMMARY_EVENT},
        }),
        ([("kind", 1), ("status", 1), ("nextEligibleAt", 1)], {
            "name": "disease_watch_alert_state_due",
            "partialFilterExpression": {"kind": ALERT_BATCH_STATE},
        }),
    )
    return [collection.create_index(keys, **options) for keys, options in definitions]


def assert_disease_watch_cutover_ready(db):
    """Refuse startup when legacy records have not all reached the destination."""
    source_counts = {name: db[name].count_documents({}) for name in SOURCE_COLLECTION_KINDS}
    destination_counts = {
        kind: db[DESTINATION_COLLECTION].count_documents({"kind": kind})
        for kind in DOCUMENT_KINDS
    }
    incomplete = [
        name for name, kind in SOURCE_COLLECTION_KINDS.items()
        if destination_counts[kind] < source_counts[name]
    ]
    if incomplete:
        raise RuntimeError(
            "Disease Watch consolidation is not ready: run and validate "
            "migrate_disease_watch_internal.py before deploying this code"
        )
    return {
        "sourceCount": sum(source_counts.values()),
        "destinationCount": sum(destination_counts.values()),
        "sourceCounts": source_counts,
        "destinationKindCounts": destination_counts,
    }
