import React from 'react';
import Layout from '@theme/Layout';
import ShowcaseCards from './_components/ShowcaseCards';
import ShowcaseFilters from './_components/ShowcaseFilters';
import {useFilteredUsers} from './_utils';


const TITLE = 'Showcase';
const DESCRIPTION = 'Discover the awesome projects in our ecosystem';

function ShowcaseHeader() {
  return (
    <section className="margin-top--lg margin-bottom--lg text--center">
      <h1>{TITLE}</h1>
      <p>{DESCRIPTION}</p>
    </section>
  );
}

export default function Showcase() {
  const {
    selectedTags,
    toggleTag,
    operator,
    toggleOperator,
    filteredUsers
  } = useFilteredUsers();

  return (
    <Layout title={TITLE} description={DESCRIPTION}>
      <main className="margin-vert--lg">
        <ShowcaseHeader />
        <ShowcaseFilters 
          selectedTags={selectedTags}
          toggleTag={toggleTag}
          operator={operator}
          toggleOperator={toggleOperator}
        />
        <ShowcaseCards users={filteredUsers} />
      </main>
    </Layout>
  );
}
