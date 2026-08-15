import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/audit_cuhk_programmes.py"
SPEC = importlib.util.spec_from_file_location("programme_audit", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)
STRUCTURE_SCRIPT = Path(__file__).resolve().parents[1] / "scripts/structure_cuhk_programmes.py"
STRUCTURE_SPEC = importlib.util.spec_from_file_location("programme_structure", STRUCTURE_SCRIPT)
STRUCTURE = importlib.util.module_from_spec(STRUCTURE_SPEC)
assert STRUCTURE_SPEC.loader
STRUCTURE_SPEC.loader.exec_module(STRUCTURE)


class ProgrammeAuditTests(unittest.TestCase):
    def test_choose_rule(self):
        hints = MODULE.semantic_hints("two courses selected from: DOTE3000, 3011", "Electives")
        self.assertEqual(hints["operator_hint"], "choose")
        self.assertEqual(hints["choose_count_hint"], 2)

    def test_slash_is_alternative(self):
        hints = MODULE.semantic_hints("ENGG1110/ESTR1002", "Faculty Package")
        self.assertEqual(hints["operator_hint"], "any_of")

    def test_required_list_is_all_of_hint(self):
        hints = MODULE.semantic_hints("ACCT2111, ACCT2121", "Required Courses")
        self.assertEqual(hints["operator_hint"], "all_of")

    def test_complex_constraints_are_flagged(self):
        hints = MODULE.semantic_hints(
            "one DOTE course at 3000 or above, excluding courses already taken", "Electives"
        )
        self.assertTrue(hints["has_level_based_pool"])
        self.assertTrue(hints["has_exclusion_or_no_double_count"])

    def test_inferred_code_can_be_corroborated_by_direct_mention(self):
        status, confidence, catalog_status = MODULE.validation_for(
            "DOTE3011", True, {}, {"DOTE"}, {"DOTE3011"}
        )
        self.assertEqual(status, "official_shorthand_corroborated")
        self.assertEqual(confidence, "high")
        self.assertEqual(catalog_status, "subject_known_course_not_in_current_index")

    def test_old_bracketed_code_is_not_a_course_mention(self):
        mentions = STRUCTURE.extract_course_mentions("ANTH3820[2820]")
        self.assertEqual([m["course_code"] for m in mentions], ["ANTH3820"])
        aliases = STRUCTURE.extract_course_aliases("ANTH3820[2820]")
        self.assertEqual(aliases[0]["former_course_code"], "ANTH2820")

    def test_level_number_is_not_inferred_as_course(self):
        mentions = STRUCTURE.extract_course_mentions("MATH courses at 3000 or above level")
        self.assertEqual(mentions, [])

    def test_subject_alias_notation_yields_current_code_and_alias(self):
        mentions = STRUCTURE.extract_course_mentions("DOTE[DSME]2011")
        self.assertEqual([m["course_code"] for m in mentions], ["DOTE2011"])
        aliases = STRUCTURE.extract_course_aliases("DOTE[DSME]2011")
        self.assertEqual(aliases[0]["former_course_code"], "DSME2011")


if __name__ == "__main__":
    unittest.main()
