
# TestPilot AI - Prompt Evaluation Record

## Module
AI Requirement Analyzer

## Sample Requirement
The user can log in using an email address and password.
If the user enters incorrect details, the system should display
an error message. After successful login, the user should be
redirected to the dashboard.

## Prompt Versions Tested

### Version 1 - Basic Prompt
- Used role-based instructions.
- Defined the analysis task.
- Identified ambiguities, missing information and assumptions.
- Generated organized output.

### Version 2 - Refined Prompt
- Added detailed analysis areas.
- Added constraints to avoid unnecessary recommendations.
- Improved output structure.
- Separated facts and assumptions clearly.

### Version 3 - Accuracy Improved
- Added strict accuracy constraints.
- Added "Not specified" instructions.
- Added a quality-check section.
- Reduced unsupported information.

## Evaluation Summary

Selected Version: Version 3

Reason for Selection:
Version 3 provided focused requirement analysis,
clear separation of facts and assumptions, and
better control over unsupported information.

## Limitations Observed
- Some assumptions may still be unnecessary.
- AI-generated clarification questions need human review.
- Output accuracy must be tested with different requirements.

## Prompt Engineering Techniques Practiced
1. Role-based prompting
2. Context engineering
3. Constraint-based prompting
4. Structured output prompting
5. Prompt refinement
6. Output evaluation
7. Quality-check prompting

## Status
Initial testing completed.
Further validation with different requirements is required.

## Additional Validation Test

### Sample Requirement
User Registration with Full Name, Email and Password.

### Result
- Correctly identified required inputs.
- Identified ambiguous success and error messages.
- Identified missing validation and password rules.
- Separated explicit facts from assumptions.
- Generated relevant clarification questions.

### Observations
- Some assumptions were unnecessary.
- Some QA concerns may not apply to every project.
- Human review is required before accepting AI-generated analysis.

### Final Decision
Version 3 selected for initial integration.