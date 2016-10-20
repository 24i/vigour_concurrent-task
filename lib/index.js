'use strict'

const Observable = require('vigour-observable')

module.exports = (limit, steps) => {
  return new Observable({
    steps: {
      child: {
        properties: {
          timeout: true,
          tryCount: true,
          run: true
        },
        tryCount: 3
      },
      inject: steps
    },
    tasks: {
      child: {
        properties: {
          timeout: true,
          step: true,
          state: true,
          tryCount: true
        },
        on: {
          data (val) {
            if (val) {
              this.step = 0
              this.tryCount = 0
              this.state = 'waiting'
            }
          }
        }
      }
    },
    define: {
      run () {
        console.log(this.status())
        this.tasks.keys()
          .filter(key => {
            const task = this.tasks[key]
            const step = this.steps[this.steps.keys()[task.step]]

            return task.state === 'waiting' || (task.state === 'error' && task.tryCount < step.tryCount)
          })
          .slice(0, limit)
          .forEach(key => {
            const task = this.tasks[key]
            const step = this.steps[this.steps.keys()[task.step]]

            task.state = 'running'

            const abort = step.run(
              task,
              data => {
                clearTimeout(task.timeout)
                task.step++
                task.tryCount = 0
                if (task.step >= this.steps.keys().length) {
                  task.state = 'done'
                  console.log(task.key, 'done')
                } else {
                  task.state = 'waiting'
                  console.log(task.key, 'step completed')
                }
                this.run()
              },
              error => {
                clearTimeout(task.timeout)
                task.state = 'error'
                task.tryCount++
                this.run()
                console.log(task.key, 'error')
              }
            )

            task.timeout = setTimeout(() => {
              if (abort.constructor === Function) {
                abort()
              }
              task.state = 'error'
              task.tryCount++
              this.run()
              console.log(task.key, 'timed out')
            }, step.timeout)
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
