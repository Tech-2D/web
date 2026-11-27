import Markdown from 'react-markdown'

const notesYear = /^(.+) · (\d{4})$/
const gradeValue = /^(1º semestre|2º semestre|média anual(?: parcial)?|média final): (\d{1,2},\d{2})$/i
const gradesResult = /^(.*?)(?:\. )?Situação em Notas: ([^.]+)\.$/
const notesUrl = 'https://tech-2d.github.io/web/notas/'
const elements = ['p', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'br']

function MarkdownReply({ text }: { text: string }) {
  return <div className="assistant-markdown">
    <Markdown skipHtml allowedElements={elements} unwrapDisallowed
      components={{ a: ({ href, children }) => href
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</> }}>
      {text}
    </Markdown>
  </div>
}

function formatNotesMarkdown(text: string, operation: string) {
  const formatted = text.replaceAll(notesUrl, `[Abrir Notas](${notesUrl})`)
  if (operation === 'grades_attention') {
    return formatted.replace(/^(Disciplinas que precisam de atenção \(\d{4}\))\n/, '### $1\n\n')
      .replace(/^• /gm, '- ').replace(/^Com lançamentos pendentes:/m, '**Com lançamentos pendentes**\n\n')
  }
  if (operation === 'grades_target') {
    return formatted.replace(/(pelo menos |meta é |final é )(\d{1,2},\d{2})/g, '$1**$2**')
  }
  if (operation === 'grades_simulate') {
    return formatted.replace(/^(Simulação com [^.]+)\. /, '**$1**\n\n')
  }
  return formatted
}

export function AssistantReply({ text, operation }: { text: string; operation?: string }) {
  if (!operation) return <MarkdownReply text={text} />
  const [firstLine, ...lines] = text.split('\n')
  const title = notesYear.exec(firstLine)
  if (!title) return <MarkdownReply text={formatNotesMarkdown(text, operation)} />

  const simulation = operation === 'grades_simulate' ? /^(Simulação com [^.]+)\. (.+)$/.exec(lines[0] ?? '') : null
  const content = simulation ? [...simulation[2].split(/(?<=\.) (?=Ainda há notas pendentes)/), ...lines.slice(1)] : lines
  const status = operation === 'grades_lookup' || simulation ? content.map(line => gradesResult.exec(line)).find(Boolean) : undefined
  const gradeParts = status?.[1] ? status[1].split(' · ') : []
  const result = gradeParts.every(item => gradeValue.test(item)) ? status : undefined
  const metrics = (result ? gradeParts : []).flatMap(item => {
    const match = gradeValue.exec(item)
    return match ? [{ label: match[1], value: match[2] }] : []
  })
  const featured = metrics.find(metric => metric.label === 'média final')
    ?? metrics.find(metric => metric.label.startsWith('média anual'))
  const remaining = metrics.filter(metric => metric !== featured)
  const details = (result ? content : lines).filter(line => line !== result?.[0] &&
    !remaining.some(metric => line === `Média informada do ${metric.label}: ${metric.value}`))
  const passing = result?.[2].startsWith('aprovação')

  return <section className="assistant-notes-reply" aria-label={`Notas de ${title[1]}, ${title[2]}`}>
    <header className="assistant-notes-heading">
      <span>Ano letivo {title[2]}</span>
      <strong>{title[1]}</strong>
    </header>
    {simulation && result && <p className="assistant-notes-scenario">{simulation[1]}</p>}
    {result && <div className="assistant-notes-overview">
      {featured && <div className="assistant-notes-average">
        <span>{featured.label}</span>
        <strong>{featured.value}</strong>
      </div>}
      <span className="assistant-notes-status" data-passing={passing || undefined}>{result[2]}</span>
    </div>}
    {remaining.length > 0 && <dl className="assistant-notes-metrics">
      {remaining.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
    </dl>}
    {details.length > 0 && <MarkdownReply text={formatNotesMarkdown(details.join('\n'), operation)} />}
  </section>
}
