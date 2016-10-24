'use strict'

const test = require('tape')

const taskRunner = require('./../lib')

test('single step sync run', t => {
  const run = taskRunner(1)

  run.set({
    steps: {
      step1: {
        run (data, resolve, reject) {
          return data.success.compute() ? resolve() : reject(new Error('some error'))
        }
      }
    },
    tasks: {
      task1: { success: true },
      task2: { success: false },
      task3: { success: true },
      task4: { success: false }
    }
  })

  var ecount = 0
  var dcount = 0

  t.plan(5)

  run
    .on('error', (key) => {
      ecount++

      if (ecount === 1) {
        t.equals(key, 'task2', 'task2 failed')
      } else if (ecount === 2) {
        t.equals(key, 'task4', 'task4 failed')
      }
    })
    .on('task-done', key => {
      dcount++

      if (dcount === 1) {
        t.equals(key, 'task1', 'task1 done')
      } else if (dcount === 2) {
        t.equals(key, 'task3', 'task3 done')
      }
    })
    .on('complete', () => {
      t.deepEqual(run.status(), {
        waiting: 0, running: 0, error: 2, done: 2
      }, 'complete status is as expected')
    })
    .run()
})

test('three step sync run', t => {
  const run = taskRunner(2)

  run.set({
    steps: {
      step1: {
        run (data, resolve, reject) {
          return data.success.compute() ? resolve() : reject(new Error('some error'))
        }
      },
      step2: {
        run (data, resolve, reject) {
          return data.success.compute() ? resolve() : reject(new Error('some error'))
        }
      },
      step3: {
        run (data, resolve, reject) {
          return data.success.compute() ? resolve() : reject(new Error('some error'))
        }
      }
    },
    tasks: {
      task1: { success: true },
      task2: { success: false },
      task3: { success: true },
      task4: { success: false }
    }
  })

  var ecount = 0
  var dcount = 0

  t.plan(5)

  run
    .on('error', (key) => {
      ecount++

      if (ecount === 1) {
        t.equals(key, 'task2', 'task2 failed')
      } else if (ecount === 2) {
        t.equals(key, 'task4', 'task4 failed')
      }
    })
    .on('task-done', key => {
      dcount++

      if (dcount === 1) {
        t.equals(key, 'task1', 'task1 done')
      } else if (dcount === 2) {
        t.equals(key, 'task3', 'task3 done')
      }
    })
    .on('complete', () => {
      t.deepEqual(run.status(), {
        waiting: 0, running: 0, error: 2, done: 2
      }, 'complete status is as expected')
    })
    .run()
})

test('two step async run', t => {
  const run = taskRunner(2)

  run.set({
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

  var ecount = 0
  var dcount = 0

  t.plan(10)

  run
    .on('error', (key) => {
      ecount++

      if ([1, 2].indexOf(ecount) !== -1) {
        t.equals(key, 'task3', 'task3 failed')
      } else if (ecount === 3) {
        t.equals(key, 'task2', 'task2 failed')
      } else if ([4, 7].indexOf(ecount) !== -1) {
        t.equals(key, 'task4', 'task4 failed')
      } else if ([5, 6].indexOf(ecount) !== -1) {
        t.equals(key, 'task2', 'task2 failed')
      }
    })
    .on('task-done', key => {
      dcount++

      if (dcount === 1) {
        t.equals(key, 'task1', 'task1 done')
      } else if (dcount === 2) {
        t.equals(key, 'task5', 'task5 done')
      }
    })
    .on('complete', () => {
      t.deepEqual(run.status(), {
        waiting: 0, running: 0, error: 3, done: 2
      }, 'complete status is as expected')
    })
    .run()
})
