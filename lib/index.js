'use strict'

const { create } = require('brisky-struct')

module.exports = (limit, steps) => {
  steps = [].concat(steps).map(step => {
    if (!step.timeout) {
      step.timeout = 1000
    }

    if (!step.tryCount) {
      step.tryCount = 1
    }

    return step
  })

  return create({
    props: {
      steps: true,
      tasks: true,
      immediate: true
    },
    steps,
    tasks: [],
    immediate: false,
    _results: {},
    define: {
      debounceRun () {
        if (this.get('immediate')) {
          clearImmediate(this.get('immediate'))
        }
        this.set({ immediate: setImmediate(this.run.bind(this)) })
      },
      addTask (tasks) {
        tasks = [].concat(tasks).map(payload => {
          return { payload, timeout: false, step: 0, tryCount: 0, state: 'waiting' }
        })
        this.set({ tasks: this.get('tasks').concat(tasks) })
      },
      run () {
        var running = 0

        const toRun = this.get('tasks').filter(task => {
          const step = this.get('steps')[task.step]

          if (task.state === 'running') {
            running++
          }

          return task.state === 'waiting' || (step && task.state === 'error' && task.tryCount < step.tryCount)
        })

        if (toRun.length < 1) {
          if (running < 1) {
            this.emit('complete')
          }
          return
        }

        toRun.slice(0, limit - running).forEach(task => {
          const thisStep = task.step
          const step = this.get('steps')[thisStep]

          task.state = 'running'

          task.timeout = setTimeout(() => {
            if (task.step !== thisStep) {
              return
            }

            if (task.abort) {
              task.abort()
            }
            this.taskError(task, new Error(`Timed out on step # ${thisStep}`))
            this.debounceRun()
          }, step.timeout)

          task.abort = step.run(
            task.payload,
            data => {
              if (task.step !== thisStep) {
                return
              }
              this.taskCompleteStep(task, data)
              this.debounceRun()
            },
            error => {
              if (task.step !== thisStep) {
                return
              }
              this.taskError(task, error)
              this.debounceRun()
            }
          )
        })
      },
      taskClear (task) {
        if (task.timeout) {
          clearTimeout(task.timeout)
        }
        if (task.state === 'running' && task.abort) {
          task.abort()
        }
      },
      taskCompleteStep (task, data) {
        if (task.state !== 'running') {
          return
        }

        this.taskClear(task)

        if (data !== undefined && data !== null) {
          this.set({ _results: data })
        }

        task.step++
        task.tryCount = 0

        if (task.step >= this.get('steps').length) {
          this.emit('task-done', task.payload)
          task.state = 'done'
        } else {
          task.state = 'waiting'
        }
      },
      taskError (task, error) {
        if (task.state !== 'running') {
          return
        }

        this.taskClear(task)

        if (!error) {
          error = new Error('Unknown Error')
        }

        this.emit('error', task.payload, error)
        task.state = 'error'
        task.tryCount++
      },
      status () {
        return this.get('tasks').reduce((status, task) => {
          status[task.state]++
          return status
        }, { waiting: 0, running: 0, error: 0, done: 0 })
      },
      results (path) {
        path = path ? ['_results'].concat(path) : '_results'
        return this.get(path).serialize()
      }
    }
  })
}
