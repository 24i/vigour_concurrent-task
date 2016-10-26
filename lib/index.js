'use strict'

const Observable = require('vigour-observable')

module.exports = (limit) => {
  return new Observable({
    steps: {
      child: {
        properties: {
          timeout: true,
          tryCount: true,
          run: true
        },
        timeout: 1000,
        tryCount: 1
      }
    },
    tasks: {
      child: {
        properties: {
          timeout: true,
          step: true,
          state: true,
          tryCount: true,
          abort: true
        },
        step: 0,
        tryCount: 0,
        state: 'waiting',
        define: {
          clear () {
            if (this.timeout) {
              clearTimeout(this.timeout)
            }
            if (this.state === 'running' && this.abort && this.abort.constructor === Function) {
              this.abort()
            }
          },
          completeStep (data) {
            if (this.state !== 'running') {
              return
            }
            this.clear()
            this.set({[`${this.step}-result`]: data})
            this.step++
            this.tryCount = 0
            if (this.step >= this.root.steps.keys().length) {
              this.root.emit('task-done', this.key)
              this.state = 'done'
            } else {
              this.state = 'waiting'
            }
          },
          error (error) {
            if (this.state !== 'running') {
              return
            }
            this.clear()
            if (!error) {
              error = new Error('Unknown Error')
            }
            this.root.emit('error', this.key, error)
            this.state = 'error'
            this.tryCount++
          }
        },
        on: {
          remove () {
            this.clear()
          }
        }
      }
    },
    properties: {
      immediate: true
    },
    define: {
      debounceRun () {
        if (this.immediate) {
          clearImmediate(this.immediate)
        }
        this.immediate = setImmediate(this.run.bind(this))
      },
      run () {
        var running = 0

        const toRun = this.tasks.keys().filter(key => {
          const task = this.tasks[key]
          const step = this.steps[this.steps.keys()[task.step]]

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

        toRun.slice(0, limit - running).forEach(key => {
          const task = this.tasks[key]
          const step = this.steps[this.steps.keys()[task.step]]

          task.state = 'running'

          task.timeout = setTimeout(() => {
            if (task.abort && task.abort.constructor === Function) {
              task.abort()
            }
            task.error(new Error(`Timed out on step ${step.key}`))
            this.debounceRun()
          }, step.timeout)

          task.abort = step.run(
            task,
            data => {
              task.completeStep(data)
              this.debounceRun()
            },
            error => {
              task.error(error)
              this.debounceRun()
            }
          )
        })
      },
      status () {
        const status = { waiting: 0, running: 0, error: 0, done: 0 }
        this.tasks.each(task => { status[task.state]++ })
        return status
      }
    }
  })
}
