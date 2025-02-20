import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {Tags, type TagType, type User} from '../../../../data/users';
import styles from './styles.module.css';

function TagIcon({label, color}: {label: string; color: string}) {
  return (
    <span
      style={{
        backgroundColor: color,
        width: 10,
        height: 10,
        borderRadius: '50%',
        marginLeft: 8,
      }}
    />
  );
}

function ShowcaseCardTag({tags}: {tags: TagType[]}) {
  return (
    <>
      {tags.map((tag) => {
        const {label, color} = Tags[tag];
        return (
          <li key={tag} className={styles.tag} title={label}>
            <span className={styles.textLabel}>{label.toLowerCase()}</span>
            <TagIcon label={label} color={color} />
          </li>
        );
      })}
    </>
  );
}

export default function ShowcaseCard({user}: {user: User}) {
  return (
    <li key={user.title} className="card shadow--md">
      <div className={clsx('card__image', styles.showcaseCardImage)}>
        {user.preview && (
          <img 
            src={user.preview} 
            alt={user.title} 
            className={styles.cardImage} 
          />
        )}
      </div>
      <div className="card__body">
        <div className={styles.showcaseCardHeader}>
          <h4 className={styles.showcaseCardTitle}>
            <Link href={user.website} className={styles.showcaseCardLink}>
              {user.title}
            </Link>
          </h4>
        </div>
        <p className={styles.showcaseCardBody}>{user.description}</p>
      </div>
      <ul className={clsx('card__footer', styles.cardFooter)}>
        <ShowcaseCardTag tags={user.tags} />
      </ul>
    </li>
  );
}
