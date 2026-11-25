// Run with: /audit-dropped-errors on <folder>
export const meta = {
  name: 'audit-dropped-errors',
  description: 'Find the errors a folder catches and then drops, and report only the findings a second agent confirms',
}

const folder = Array.isArray(args) ? args[0] : args
if (!folder) throw new Error('Name a folder: Run /audit-dropped-errors on <folder>')

const listing = await agent(`List every file under ${folder}/, each as a path from this folder.`, {
  schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
})
const found = await pipeline(listing.files, (file) =>
  agent(`List each place in ${file} where an error is caught and then dropped. One finding per line, as file:line: reason. Say NONE if there are none.`, { label: file }),
)
const findings = found.flatMap((answer) => (!answer || answer.trim() === 'NONE' ? [] : answer.split('\n').filter((line) => line.trim())))
const verdicts = await pipeline(findings, (finding) =>
  agent(`Open the cited line and decide: does this code catch an error and drop it? Answer CONFIRMED or REFUTED, then one sentence.\n${finding}`, { label: 'check' }),
)

return findings.filter((_, i) => verdicts[i]?.startsWith('CONFIRMED')).join('\n') || 'No confirmed findings.'
