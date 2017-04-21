# concurrent-task

[![Build Status](https://travis-ci.org/vigour-io/concurrent-task.svg?branch=master)](https://travis-ci.org/vigour-io/concurrent-task)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![npm version](https://badge.fury.io/js/concurrent-task.svg)](https://badge.fury.io/js/concurrent-task)
[![Coverage Status](https://coveralls.io/repos/github/vigour-io/concurrent-task/badge.svg?branch=master)](https://coveralls.io/github/vigour-io/concurrent-task?branch=master)

A `brisky-struct` instance to run async tasks in parallel with a concurrency limit

## Installing

```bash
npm install concurrent-task --save
```

## Usage

Below is an example of 5 tasks with 2 steps to execute for each. Each step has a `run` method which returns an aborting function. If step is not resolved or rejected in time, it will be aborted and an error will be emitted.

```js
  const concurrent = require('concurrent-task')
  
  const steps = [
    {
      timeout: 1000,
      tryCount: 2,
      run (task, resolve, reject) {
        return clearTimeout.bind(null, setTimeout(() => {
          return task.success ? resolve() : reject(new Error('some error'))
        }, task.seconds * 1000))
      }
    },
    {
      timeout: 500,
      tryCount: 3,
      run (task, resolve, reject) {
        return clearTimeout.bind(null, setTimeout(() => {
          return task.success ? resolve({ [task.id]: 'result' }) : reject(new Error('some error'))
        }, task.seconds * 1000))
      }
    }
  ]

  // create a task runner with steps
  const runner = concurrent(steps)

  // this method can be called several times
  // so to add more tasks on the go
  runner.addTask([
    { id: 'task1', seconds: 0.3, success: true },
    { id: 'task2', seconds: 0.7, success: true },
    { id: 'task3', seconds: 0.2, success: false },
    { id: 'task4', seconds: 1.2, success: false },
    { id: 'task5', seconds: 0.3, success: true }
  ])

  runner
    .on('error', (task, error) => {
      // one of tasks had an error on one of steps
      // task is something like { id: 'task3', seconds: 0.2, success: false }
    })
    .on('task-done', task => {
      // one of tasks completed all steps with no error
      // task is something like { id: 'task3', seconds: 0.2, success: false }
    })
    .on('complete', () => {
      // all the tasks completed all steps
      // if any of them had errors
      // tryCounts are exhausted

      // log runner status
      console.log(runner.status())
      // logs something like: { waiting: 0, running: 0, error: 2, done: 3 }
      
      // log task results
      console.log(runner.results())
      // logs something like: { task1: 'result', task5: 'result' }
      
      // keep memory clean
      runner.set(null)
    })
    // run with concurrency limited to 2
    .run(2)
```
