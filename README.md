# concurrent-task

[![Build Status](https://travis-ci.org/vigour-io/concurrent-task.svg?branch=master)](https://travis-ci.org/vigour-io/concurrent-task)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![npm version](https://badge.fury.io/js/concurrent-task.svg)](https://badge.fury.io/js/concurrent-task)
[![Coverage Status](https://coveralls.io/repos/github/vigour-io/concurrent-task/badge.svg?branch=master)](https://coveralls.io/github/vigour-io/concurrent-task?branch=master)

An observable to run async tasks in parallel with a concurrency limit

## Installing

```bash
npm install concurrent-task --save
```

## Usage

Below is an example of 5 tasks with 2 steps to execute for each.

```js
  const concurrent('concurrent-task')
  
  // create a task runner with concurrency limit 2
  const runner = concurrent(2)

  runner.set({
    steps: {
      step1: {
        timeout: 1000,
        tryCount: 2,
        run (data, resolve, reject) {
          return clearTimeout.bind(null, setTimeout(() => {
            return data.success.compute() ? resolve() : reject(new Error('some error'))
          }, data.seconds * 1000))
        }
      },
      step2: {
        timeout: 500,
        tryCount: 3,
        run (data, resolve, reject) {
          return clearTimeout.bind(null, setTimeout(() => {
            return data.success.compute() ? resolve() : reject(new Error('some error'))
          }, data.seconds * 1000))
        }
      }
    },
    tasks: {
      task1: { seconds: 0.3, success: true },
      task2: { seconds: 0.7, success: true },
      task3: { seconds: 0.2, success: false },
      task4: { seconds: 1.2, success: false },
      task5: { seconds: 0.3, success: true }
    }
  })

  runner
    .on('error', (key, error) => {
      // one of tasks had an error on one of steps
      // key is key of task
    })
    .on('task-done', key => {
      // one of tasks completed all steps with no error
    })
    .on('complete', () => {
      // all the tasks completed all steps
      // if any of them had errors
      // tryCounts are exhausted

      // log runner status
      console.log(runner.status())
    })
    .run()
```
