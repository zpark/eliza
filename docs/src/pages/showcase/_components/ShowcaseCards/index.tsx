import React from 'react';
import clsx from 'clsx';
import {sortedUsers, type User} from '../../../../data/users';
import ShowcaseCard from '../ShowcaseCard';
import styles from './styles.module.css';

function ShowcaseCards({users}: {users: User[]}): JSX.Element {
  if (users.length === 0) {
    return (
      <section className="container margin-top--lg margin-bottom--xl">
        <h2>No results found</h2>
        <p>Try adjusting your search or filter criteria.</p>
      </section>
    );
  }

  return (
    <section className="container margin-top--lg margin-bottom--xl">
      <div className={clsx('margin-bottom--md')}>
        <h2>{users.length} {users.length === 1 ? 'Site' : 'Sites'}</h2>
      </div>
      <ul className={clsx('clean-list', styles.showcaseList)}>
        {users.map((user) => (
          <ShowcaseCard key={user.title} user={user} />
        ))}
      </ul>
    </section>
  );
}

export default ShowcaseCards;
