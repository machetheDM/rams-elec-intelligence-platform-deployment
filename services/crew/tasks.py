"""
CrewAI Tasks — the chained triage workflow
==========================================

Three tasks, executed in order, each declaring the previous ones as
`context`. That is what makes this a crew rather than three separate calls:
CrewAI injects the prior tasks' outputs into the next agent's prompt, so the
cost estimator sees what the classifier decided without the endpoint having
to marshal data between them by hand.

`{inquiry}` in the first task's description is interpolated by CrewAI from
the `inputs` dict passed to `crew.kickoff(inputs={"inquiry": ...})`.

OUTPUT SHAPE
  expected_output on each task is deliberately explicit about returning JSON
  with named keys. CrewAI will otherwise happily return prose, which the
  endpoint then cannot parse into a structured response.
"""

from crewai import Agent, Task


def build_tasks(
    classifier: Agent,
    cost_estimator: Agent,
    technician_matcher: Agent,
) -> tuple[Task, Task, Task]:
    """Build the three chained tasks."""

    classify_task = Task(
        description=(
            "A customer has submitted the following inquiry:\n\n"
            "{inquiry}\n\n"
            "Use the classify_inquiry tool on the message exactly as written. "
            "Do not paraphrase it before passing it to the tool. Report the "
            "tool's classification. If the tool reports an error, say so "
            "plainly rather than guessing a classification."
        ),
        expected_output=(
            "A JSON object with exactly these keys: service_category, urgency, "
            "equipment_mentioned (a list), area_zone (or null), "
            "estimated_scope, confidence."
        ),
        agent=classifier,
    )

    estimate_cost_task = Task(
        description=(
            "Using the classification from the previous task, call the "
            "estimate_cost tool with that service_category, urgency, "
            "estimated_scope and area_zone.\n\n"
            "The cost_min and cost_max the tool returns come from a trained "
            "model and are authoritative. Report them EXACTLY as returned — "
            "do not round them, average them, convert them or adjust them for "
            "any reason. Include the tool's explanation of the cost drivers."
        ),
        expected_output=(
            "A JSON object with exactly these keys: cost_min, cost_max, "
            "confidence, explanation, similar_jobs_count. The cost_min and "
            "cost_max values must be byte-for-byte what the tool returned."
        ),
        agent=cost_estimator,
        context=[classify_task],
    )

    match_technician_task = Task(
        description=(
            "Using the classification and the cost estimate from the previous "
            "tasks, call the recommend_technician tool to find the best-matched "
            "technicians.\n\n"
            "If no area_zone was identified during classification, say so and "
            "explain that a suburb is required before dispatch can be scored — "
            "do not invent one."
        ),
        expected_output=(
            "A JSON object with a 'recommendations' list of up to 3 technicians, "
            "each with technician_id, name, combined_score and explanation, plus "
            "a short summary of why the top match was chosen."
        ),
        agent=technician_matcher,
        context=[classify_task, estimate_cost_task],
    )

    return classify_task, estimate_cost_task, match_technician_task
