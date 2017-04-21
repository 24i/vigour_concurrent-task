'use strict'

const test = require('tape')

const taskRunner = require('../lib')

test('single step sync run with concurrency = 1', t => {
  const steps = { run (task, resolve, reject) {
    return task.success ? resolve() : reject()
  } }

  const run = taskRunner(steps)

  run.addTask({ id: 'task1', success: true })
  run.addTask([
    { id: 'task2', success: false },
    { id: 'task3', success: true },
    { id: 'task4', success: false }
  ])

  var ecount = 0
  var dcount = 0

  t.plan(5)

  run
    .on('error', (task) => {
      ecount++

      if (ecount === 1) {
        t.equals(task.id, 'task2', 'task2 failed')
      } else if (ecount === 2) {
        t.equals(task.id, 'task4', 'task4 failed')
      }
    })
    .on('task-done', (task) => {
      dcount++

      if (dcount === 1) {
        t.equals(task.id, 'task1', 'task1 done')
      } else if (dcount === 2) {
        t.equals(task.id, 'task3', 'task3 done')
      }
    })
    .on('complete', () => {
      t.deepEqual(run.status(), {
        waiting: 0, running: 0, error: 2, done: 2
      }, 'complete status is as expected')
      run.set(null)
    })
    .run(1)
})

test('three step sync run with concurrency = 2', t => {
  const steps = [
    { run (task, resolve, reject) {
      return task.success ? resolve() : reject()
    } },
    { run (task, resolve, reject) {
      return task.success ? resolve() : reject()
    } },
    { run (task, resolve, reject) {
      return task.success ? resolve() : reject()
    } }
  ]

  const run = taskRunner(steps)

  run.addTask([
    { id: 'task1', success: true },
    { id: 'task2', success: false },
    { id: 'task3', success: true },
    { id: 'task4', success: false }
  ])

  var ecount = 0
  var dcount = 0

  t.plan(5)

  run
    .on('error', task => {
      ecount++

      if (ecount === 1) {
        t.equals(task.id, 'task2', 'task2 failed')
      } else if (ecount === 2) {
        t.equals(task.id, 'task4', 'task4 failed')
      }
    })
    .on('task-done', task => {
      dcount++

      if (dcount === 1) {
        t.equals(task.id, 'task1', 'task1 done')
      } else if (dcount === 2) {
        t.equals(task.id, 'task3', 'task3 done')
      }
    })
    .on('complete', () => {
      t.deepEqual(run.status(), {
        waiting: 0, running: 0, error: 2, done: 2
      }, 'complete status is as expected')
      run.set(null)
    })
    .run(2)
})

test('two step async run with concurrency = 2', t => {
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
          return task.success ? resolve({ [task.id]: true }) : reject(new Error('some error'))
        }, task.seconds * 1000))
      }
    }
  ]
  const run = taskRunner(steps)

  run.addTask([
    { id: 'task1', seconds: 0.3, success: true },
    { id: 'task2', seconds: 0.7, success: true },
    { id: 'task3', seconds: 0.2, success: false },
    { id: 'task4', seconds: 1.2, success: false },
    { id: 'task5', seconds: 0.3, success: true }
  ])

  var ecount = 0
  var dcount = 0

  t.plan(11)

  run
    .on('error', task => {
      ecount++

      if ([1, 2].indexOf(ecount) !== -1) {
        t.equals(task.id, 'task3', 'task3 failed')
      } else if ([3, 4, 6].indexOf(ecount) !== -1) {
        t.equals(task.id, 'task2', 'task2 failed')
      } else if ([5, 7].indexOf(ecount) !== -1) {
        t.equals(task.id, 'task4', 'task4 failed')
      }
    })
    .on('task-done', task => {
      dcount++

      if (dcount === 1) {
        t.equals(task.id, 'task1', 'task1 done')
      } else if (dcount === 2) {
        t.equals(task.id, 'task5', 'task5 done')
      }
    })
    .on('complete', () => {
      t.deepEqual(run.status(), {
        waiting: 0, running: 0, error: 3, done: 2
      }, 'complete status is as expected')
      t.deepEqual(run.results(), {
        task1: true, task5: true
      }, 'complete results are as expected')
      run.set(null)
    })
    .run(2)
})
