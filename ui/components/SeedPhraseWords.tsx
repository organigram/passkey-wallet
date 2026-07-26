export const SeedPhraseWords = ({
  phrase
}: {
  phrase: string
}): JSX.Element => {
  const words = phrase.trim().split(/\s+/).filter(Boolean)

  return (
    <div className='seed-word-grid'>
      {words.map((word, index) => (
        <div className='seed-word-card' key={`${word}-${index}`}>
          <span>{index + 1}</span>
          <strong>{word}</strong>
        </div>
      ))}
    </div>
  )
}
