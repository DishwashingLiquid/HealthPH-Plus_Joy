"""Saved disease-model evaluations, supplied by the research team."""
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

Probability = Annotated[float, Field(strict=True, ge=0, le=1, allow_inf_nan=False)]
PositiveCount = Annotated[StrictInt, Field(gt=0)]
Language = Literal["en", "fil", "hil", "ilo", "ceb"]
Disease = Literal["AURI", "PN", "TB", "COVID"]


class EvaluationMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    macroF1: Probability | None = None
    microF1: Probability | None = None
    precisionMacro: Probability | None = None
    recallMacro: Probability | None = None
    hammingLoss: Probability | None = None

    @model_validator(mode="after")
    def needs_a_recorded_metric(self):
        if all(getattr(self, key) is None for key in EvaluationMetrics.model_fields):
            raise ValueError("Add at least one recorded metric; leave unmeasured metrics null.")
        return self


class LanguageEvaluation(EvaluationMetrics):
    language: Language
    sampleCount: PositiveCount


class DiseaseModelEvaluation(EvaluationMetrics):
    id: Literal["electra", "xlmr"]
    modelVersion: Annotated[str, Field(min_length=1, max_length=200)]
    evaluationSet: Annotated[str, Field(min_length=1, max_length=200)]
    testSetId: Annotated[str, Field(min_length=1, max_length=200)]
    evaluationProtocol: Annotated[str, Field(min_length=1, max_length=200)]
    split: Literal["test", "validation"]
    evaluatedAt: date
    sampleCount: PositiveCount
    thresholds: dict[Disease, Probability]
    languages: Annotated[list[Language], Field(min_length=1, max_length=5)]
    perLanguage: Annotated[list[LanguageEvaluation], Field(max_length=5)] = Field(default_factory=list)

    @field_validator("modelVersion", "evaluationSet", "testSetId", "evaluationProtocol")
    @classmethod
    def clean_metadata(cls, value):
        value = value.strip()
        if not value or value.upper().startswith("REPLACE_"):
            raise ValueError("Replace the template placeholder with the recorded evaluation details.")
        return value

    @field_validator("evaluatedAt", mode="before")
    @classmethod
    def date_format(cls, value):
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError("Use an evaluation date in YYYY-MM-DD format.")
        return date.fromisoformat(value)

    @model_validator(mode="after")
    def validate_breakdowns(self):
        if set(self.thresholds) != {"AURI", "PN", "TB", "COVID"}:
            raise ValueError("Thresholds must include AURI, PN, TB and COVID.")
        if len(set(self.languages)) != len(self.languages):
            raise ValueError("List each tested language only once.")
        codes = [row.language for row in self.perLanguage]
        if len(set(codes)) != len(codes):
            raise ValueError("Add only one perLanguage result for each language.")
        for row in self.perLanguage:
            if row.language not in self.languages:
                raise ValueError("Each perLanguage result must be listed in languages.")
            if row.sampleCount > self.sampleCount:
                raise ValueError("A language sample count cannot exceed the total sample count.")
        return self


class EvaluationUpload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Annotated[StrictInt, Field(ge=1, le=1)]
    models: Annotated[list[DiseaseModelEvaluation], Field(min_length=1, max_length=2)]

    @model_validator(mode="after")
    def unique_models(self):
        ids = [model.id for model in self.models]
        if len(set(ids)) != len(ids):
            raise ValueError("Include each model only once in a file.")
        return self
