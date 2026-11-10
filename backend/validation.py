"""Authoritative write validation before requests reach Supabase RLS."""

import re
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    field_validator,
    model_validator,
)

Money = Annotated[StrictInt, Field(ge=0, le=10_000_000)]


class WriteModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def trim_strings(cls, value):
        return value.strip() if isinstance(value, str) else value


class Listing(WriteModel):
    owner_id: UUID | None = None
    university_id: UUID | None = None
    title: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    description: Annotated[str, Field(min_length=1, max_length=5000)] | None = None
    approximate_location: Annotated[str, Field(min_length=1, max_length=120)] | None = (
        None
    )
    monthly_rent: Money | None = None
    property_type: Literal["room", "apartment", "house", "studio"] | None = None
    available_from: str | None = None
    available_until: str | None = None
    bedrooms: Annotated[StrictInt, Field(ge=0, le=20)] | None = None
    bathrooms: (
        Annotated[float, Field(ge=0, le=20, strict=True, allow_inf_nan=False)] | None
    ) = None
    status: Literal["draft", "active", "unavailable", "expired"] | None = None

    @field_validator("available_from", "available_until")
    @classmethod
    def dates(cls, value):
        return valid_date(value)

    @model_validator(mode="after")
    def ordered(self):
        ordered(self.available_from, self.available_until)
        return self


class Profile(WriteModel):
    id: UUID | None = None
    display_name: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    university_id: UUID | None = None
    target_university_id: UUID | None = None
    bio: Annotated[str, Field(max_length=1000)] | None = None
    min_budget: Money | None = None
    max_budget: Money | None = None
    move_in_date: str | None = None
    move_out_date: str | None = None
    seeking_roommate: StrictBool | None = None
    cleanliness: (
        Literal["Not specified", "Very tidy", "Generally tidy", "Relaxed"] | None
    ) = None
    sleep_schedule: (
        Literal["Not specified", "Early riser", "Night owl", "Flexible"] | None
    ) = None
    pets_preference: Literal["Not specified", "Pet friendly", "No pets"] | None = None
    smoking_preference: (
        Literal["Not specified", "Smoke free", "Open to discussion"] | None
    ) = None

    @field_validator("move_in_date", "move_out_date")
    @classmethod
    def dates(cls, value):
        return valid_date(value)

    @model_validator(mode="after")
    def ordered(self):
        ordered(self.min_budget, self.max_budget)
        ordered(self.move_in_date, self.move_out_date)
        return self


def valid_date(value):
    if value is not None:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Invalid date")
        date.fromisoformat(value)
    return value


def ordered(start, end):
    if start is not None and end is not None and start > end:
        raise ValueError("Range must be ordered")


def uuid(value):
    return str(UUID(str(value)))


def validate_write(table, value, actor, method):
    if not isinstance(value, dict) or not value:
        raise ValueError("A nonempty JSON object is required")
    if table in {"profiles", "housing_listings"}:
        model = Profile if table == "profiles" else Listing
        actor_key = "id" if table == "profiles" else "owner_id"
        # Ignore caller-supplied identity; write only as the verified actor.
        value = {**value, actor_key: actor}
        result = model.model_validate(value).model_dump(mode="json", exclude_unset=True)
        nullable = (
            {"min_budget", "max_budget", "move_in_date", "move_out_date"}
            if table == "profiles"
            else {"available_until"}
        )
        if any(v is None and k not in nullable for k, v in result.items()):
            raise ValueError("Required fields cannot be null")
        required = (
            {"display_name", "university_id", "target_university_id"}
            if table == "profiles"
            else {
                "title",
                "description",
                "university_id",
                "monthly_rent",
                "approximate_location",
                "property_type",
                "available_from",
            }
        )
        if method == "POST" and not required <= result.keys():
            raise ValueError("Required fields are missing")
        if method == "PATCH":
            result.pop(actor_key, None)
            if not result:
                raise ValueError("No editable fields supplied")
        return result
    allowed = {
        "blocks": {"blocker_id", "blocked_id"},
        "reports": {
            "reporter_id",
            "reported_user_id",
            "listing_id",
            "conversation_id",
            "reason",
            "details",
            "evidence_message_ids",
        },
        "pilot_events": {"user_id", "event", "entity_id"},
    }[table]
    if not value.keys() <= allowed:
        raise ValueError("Unknown write fields")
    result = dict(value)
    result[
        {"blocks": "blocker_id", "reports": "reporter_id", "pilot_events": "user_id"}[
            table
        ]
    ] = actor
    if table == "blocks":
        result["blocked_id"] = uuid(result["blocked_id"])
        if result["blocked_id"] == actor:
            raise ValueError("Cannot block yourself")
    elif table == "reports":
        if (
            result.get("reason") not in {"misleading", "scam", "harassment", "other"}
            or not isinstance(result.get("details"), str)
            or not 1 <= len(result["details"].strip()) <= 3000
        ):
            raise ValueError("Invalid report")
        if not result.get("reported_user_id") and not result.get("listing_id"):
            raise ValueError("A report target is required")
        for key in ("reported_user_id", "listing_id", "conversation_id"):
            if result.get(key) is not None:
                result[key] = uuid(result[key])
        evidence = result.get("evidence_message_ids", [])
        if not isinstance(evidence, list) or len(evidence) > 20:
            raise ValueError("Invalid evidence")
        result["evidence_message_ids"] = [uuid(item) for item in evidence]
    else:
        if result.get("event") not in {
            "profile_completed",
            "listing_published",
            "connection_confirmed",
        }:
            raise ValueError("Invalid event")
        result["entity_id"] = (
            None
            if result["event"] == "profile_completed"
            else uuid(result.get("entity_id"))
        )
    return result


RPC_FIELDS = {
    "is_confirmed_member": set(),
    "is_moderator": set(),
    "request_deletion": set(),
    "start_conversation": {"recipient", "context_type", "context_id"},
    "send_message": {"conversation", "client_request_id", "body"},
    "move_listing_image": {"image", "direction"},
    "moderate_report": {"report", "action", "reason"},
    "get_report_detail": {"report"},
}


def validate_rpc(name, value):
    if not isinstance(value, dict) or value.keys() != RPC_FIELDS[name]:
        raise ValueError("Invalid RPC fields")
    for key in {
        "recipient",
        "context_id",
        "conversation",
        "client_request_id",
        "image",
        "report",
    } & value.keys():
        value[key] = uuid(value[key])
    if name == "start_conversation" and value["context_type"] not in {
        "profile",
        "listing",
    }:
        raise ValueError("Invalid conversation context")
    if name == "send_message" and (
        not isinstance(value["body"], str)
        or not 1 <= len(value["body"].strip()) <= 2000
    ):
        raise ValueError("Invalid message")
    if name == "move_listing_image" and (
        type(value["direction"]) is not int or value["direction"] not in {-1, 1}
    ):
        raise ValueError("Invalid direction")
    if name == "moderate_report" and (
        value["action"] not in {"review", "restrict_user", "remove_listing", "resolve"}
        or not isinstance(value["reason"], str)
        or not 1 <= len(value["reason"].strip()) <= 1000
    ):
        raise ValueError("Invalid moderation action")
    return value
