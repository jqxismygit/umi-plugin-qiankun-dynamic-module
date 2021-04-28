import React from 'react';
console.log('window.sensoro$core$lib$demo --->> = ', window.sensoro$core$lib$demo);
// const { default: demo, test1 } = window.sensoro$core$demo;
import demo, { test1 } from '@sensoro/core/lib/demo';
import { get } from 'lodash';
import styles from './index.css';

export default () => {
  const a = { b: 1 };
  console.log('get = ', get(a, 'b'));
  demo();
  test1();
  return <div className={styles.normal}>Hello Umi!</div>;
};
