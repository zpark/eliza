import React from 'react';
import clsx from 'clsx';
import {TagList, Tags, type TagType} from '../../../../data/users';
import styles from './styles.module.css';

type OperatorToggleProps = {
  operator: 'AND' | 'OR';
  toggleOperator: () => void;
};

function OperatorToggle({operator, toggleOperator}: OperatorToggleProps) {
  return (
    <button 
      className={styles.operatorButton}
      onClick={toggleOperator}
      title={operator === 'OR' ? 'Switch to AND' : 'Switch to OR'}
    >
      {operator}
    </button>
  );
}

type ShowcaseTagSelectProps = {
  tag: TagType;
  label: string;
  icon?: React.ReactNode;
  description: string;
  selected: boolean;
  onToggle: () => void;
};

function ShowcaseTagSelect({
  tag,
  label,
  icon,
  description,
  selected,
  onToggle,
}: ShowcaseTagSelectProps) {
  return (
    <li className={styles.tagListItem}>
      <input
        type="checkbox"
        id={tag}
        checked={selected}
        onChange={onToggle}
        className="screen-reader-only"
      />
      <label htmlFor={tag} className={styles.checkboxLabel} title={description}>
        {label}
        {icon}
      </label>
    </li>
  );
}

type ShowcaseFiltersProps = {
  selectedTags: TagType[];
  toggleTag: (tag: TagType) => void;
  operator: 'AND' | 'OR';
  toggleOperator: () => void;
};

export default function ShowcaseFilters({
  selectedTags,
  toggleTag,
  operator,
  toggleOperator,
}: ShowcaseFiltersProps): JSX.Element {
  return (
    <section className="container margin-top--l margin-bottom--lg">
      <div className={styles.filterHeader}>
        <div className={styles.filterTitle}>
          <h2>Filters</h2>
          <OperatorToggle operator={operator} toggleOperator={toggleOperator} />
        </div>
      </div>
      <ul className={clsx('clean-list', styles.tagList)}>
        {TagList.map((tag) => {
          const {label, description} = Tags[tag];
          return (
            <ShowcaseTagSelect
              key={tag}
              tag={tag}
              label={label}
              description={description}
              selected={selectedTags.includes(tag)}
              onToggle={() => toggleTag(tag)}
            />
          );
        })}
      </ul>
    </section>
  );
}
