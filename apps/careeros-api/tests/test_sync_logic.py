"""Pure logic for the ATS sync: wording, matching, URL normalisation, secrets. No database or browser."""

from __future__ import annotations

import pytest

from app.urlnorm import normalize_company, normalize_url
from jobs.ats.base import Credentials, NeedsAttention, PortalEntry
from jobs.ats.matching import Candidate, match_entry
from jobs.ats.secrets import env_prefix, get_credentials
from jobs.ats.status_mapping import Mapped, decide_change, map_status


@pytest.mark.parametrize(
    ("text", "status", "confidence"),
    [
        ("Application Received", "Applied", "high"),
        ("Submitted", "Applied", "high"),
        ("Under Review", "Applied", "medium"),
        ("Phone Screen Scheduled", "Screening", "high"),
        ("Interview Scheduled", "Interview", "high"),
        ("Offer Extended", "Offer", "high"),
        ("Not Selected", "Rejected", "high"),
        ("We have decided not to move forward", "Rejected", "high"),
        ("Candidate withdrew", "Withdrawn", "high"),
        ("Offer declined", "Withdrawn", "medium"),
    ],
)
def test_known_wording_maps_to_tracker_statuses(text, status, confidence):
    mapped = map_status(text)
    assert (mapped.status, mapped.confidence) == (status, confidence)


@pytest.mark.parametrize("text", ["Awaiting committee", "Position filled", "Assessment required", "", "   ", None])
def test_unknown_wording_is_never_guessed(text):
    mapped = map_status(text)
    assert mapped.status is None
    assert mapped.confidence == "low"


def test_negative_phrasings_are_not_mistaken_for_progress():
    assert map_status("Offer rescinded").status == "Withdrawn"
    assert map_status("Interview cancelled - not selected").status == "Rejected"


def test_applied_and_offer_need_wording_that_says_so():
    assert map_status("Awaiting committee").status is None
    assert map_status("Your application is moving along").status is None


class TestDecideChange:
    def test_moves_forward_only(self):
        assert decide_change("Applied", map_status("Interview Scheduled")) == "Interview"
        assert decide_change("Interview", map_status("Under Review")) is None  # no regression
        assert decide_change("Applied", map_status("Application Received")) is None  # same

    def test_endings_can_follow_any_stage_but_closed_stays_closed(self):
        assert decide_change("Saved", map_status("Not Selected")) == "Rejected"
        assert decide_change("Interview", map_status("Candidate withdrew")) == "Withdrawn"
        assert decide_change("Rejected", map_status("Interview Scheduled")) is None

    def test_low_confidence_and_unmapped_never_change_anything(self):
        assert decide_change("Applied", map_status("Awaiting committee")) is None
        assert decide_change("Applied", Mapped("Offer", "low", "x")) is None

    def test_offer_needs_high_confidence(self):
        assert decide_change("Interview", Mapped("Offer", "medium", "x")) is None
        assert decide_change("Interview", Mapped("Offer", "high", "x")) == "Offer"


def test_url_normalisation_matches_regardless_of_noise():
    a = normalize_url("HTTPS://Careers.Acme.com:443/Jobs/123/?utm_source=x#apply")
    assert a == "https://careers.acme.com/jobs/123"
    assert normalize_url("https://careers.acme.com/jobs/123/") == a
    assert normalize_url("ftp://x.test/a") is None and normalize_url("not a url") is None and normalize_url(None) is None
    assert normalize_url("http://localhost:8080/a") == "http://localhost:8080/a"


def test_company_normalisation_ignores_suffixes_and_punctuation():
    assert normalize_company("Acme, Inc.") == normalize_company("ACME") == "acme"


CANDIDATES = [
    Candidate(1, "https://acme.test/jobs/1", "R-100", "Cloud Support Engineer", "Acme Inc."),
    Candidate(2, "https://acme.test/jobs/2", None, "Data Center Technician", "Acme Inc."),
    Candidate(3, "https://other.test/jobs/3", None, "Data Center Technician", "Other Co"),
]


def entry(**kw) -> PortalEntry:
    base = dict(external_id="x", title="T", status_text="s")
    base.update(kw)
    return PortalEntry(**base)


class TestMatching:
    def test_url_first(self):
        m = match_entry(entry(url="https://ACME.test/jobs/2/?ref=1", title="whatever"), CANDIDATES)
        assert (m.application_id, m.by, m.confidence) == (2, "url", 1.0)

    def test_then_requisition(self):
        m = match_entry(entry(requisition_id="r-100"), CANDIDATES)
        assert (m.application_id, m.by) == (1, "requisition")

    def test_then_company_and_close_title(self):
        m = match_entry(entry(title="Cloud Support Engineer II", company="ACME"), CANDIDATES)
        assert m.application_id == 1 and m.by == "title_company" and m.confidence < 0.9

    def test_same_title_at_two_companies_is_resolved_by_company(self):
        assert match_entry(entry(title="Data Center Technician", company="Other Co."), CANDIDATES).application_id == 3

    def test_ambiguity_is_left_unmatched(self):
        twins = [Candidate(10, "https://a.test/1", None, "Support Engineer", "Acme"), Candidate(11, "https://a.test/2", None, "Support Engineers", "Acme")]
        assert match_entry(entry(title="Support Engineer", company="Acme"), twins) is None

    def test_no_company_means_no_fuzzy_match(self):
        assert match_entry(entry(title="Cloud Support Engineer"), CANDIDATES) is None

    def test_unrelated_entries_are_unmatched(self):
        assert match_entry(entry(title="Chef", company="Acme"), CANDIDATES) is None


class TestSecrets:
    def test_reads_by_reference_and_never_prints_the_password(self):
        creds = get_credentials("workday-acme", {"CAREEROS_SECRET_WORKDAY_ACME_USERNAME": "me@example.test", "CAREEROS_SECRET_WORKDAY_ACME_PASSWORD": "hunter2"})
        assert creds == Credentials("me@example.test", "hunter2")
        assert "hunter2" not in repr(creds) and "me@example.test" not in repr(creds)
        assert env_prefix("workday-acme") == "CAREEROS_SECRET_WORKDAY_ACME"

    def test_missing_secrets_name_the_variables_not_values(self):
        with pytest.raises(NeedsAttention) as err:
            get_credentials("workday-acme", {"CAREEROS_SECRET_WORKDAY_ACME_USERNAME": "me"})
        assert "CAREEROS_SECRET_WORKDAY_ACME_PASSWORD" in str(err.value)
