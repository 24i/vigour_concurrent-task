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
        timeout: 3000,
        tryCount: 3
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
          clearTimeout () {
            if (this.timeout) {
              clearTimeout(this.timeout)
            }
          },
          completeStep (data) {
            this.clearTimeout()
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
            if (!error) {
              error = new Error('Unknown Error')
            }
            this.clearTimeout()
            this.root.emit('error', this.key, error)
            this.state = 'error'
            this.tryCount++
          }
        },
        on: {
          remove () {
            this.clearTimeout()
            if (this.state === 'running' && this.abort && this.abort.constructor === Function) {
              this.abort()
            }
          }
        }
      }
    },
    define: {
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

        toRun.slice(0, limit).forEach(key => {
          const task = this.tasks[key]
          const step = this.steps[this.steps.keys()[task.step]]

          task.state = 'running'

          task.timeout = setTimeout(() => {
            if (task.abort && task.abort.constructor === Function) {
              task.abort()
            }
            task.error(new Error(`Timed out on step ${step.key}`))
            setImmediate(this.run.bind(this))
          }, step.timeout)

          task.abort = step.run(
            task,
            data => {
              task.completeStep(data)
              setImmediate(this.run.bind(this))
            },
            error => {
              task.error(error)
              setImmediate(this.run.bind(this))
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
