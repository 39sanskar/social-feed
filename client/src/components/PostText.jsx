import { Link } from 'react-router-dom';

// Splitting with a capture group puts every match at an ODD index.
const TOKEN = /(https?:\/\/[^\s]+|#[A-Za-z_][A-Za-z0-9_]{0,49}|@[A-Za-z0-9_]{3,20})/g;

/**
 * Turns #hashtags, @mentions and links into real links.
 * Everything is built from React elements (never dangerouslySetInnerHTML), so
 * user text can't inject HTML or scripts (XSS-safe by construction).
 */
export default function PostText({ text }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const isTag = part[0] === '#';
        const isMention = part[0] === '@';
        // "a@b.com" or "word#tag": the symbol is glued to a word, so it isn't a mention/hashtag
        if ((isTag || isMention) && /\w$/.test(parts[i - 1])) return part;
        if (isTag) return <Link key={i} to={`/tag/${part.slice(1).toLowerCase()}`}>{part}</Link>;
        if (isMention) return <Link key={i} to={`/u/${part.slice(1).toLowerCase()}`}>{part}</Link>;
        const [, url, trail] = part.match(/^(.*?)([.,!?)\]]*)$/); // keep sentence punctuation out of the link
        return (
          <span key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer nofollow ugc">{url}</a>{trail}
          </span>
        );
      })}
    </>
  );
}
