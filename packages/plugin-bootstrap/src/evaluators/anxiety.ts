// Evaluate if the agent is being annoying or filling the chat with too much noise
// If the agent has not spoken within the last 5 minutes, cut anxiety score in half (decay by half over 5 mins)
// If the agent is engaging in conversation with users who are not a OWNER or ADMIN role, set the anxiety score between 0 and 10
// For each time the agent speaks to a USER unnecessarily, increase the anxiety amount
// If an OWNER or ADMIN directly addresses the agent, set anxiety score to 0 (reset the score)