'use strict'

const Observable = require('vigour-observable')

module.exports = (limit, steps) => {
  return new Observable({
    steps: {
      child: {
        properties: {
          timeout: true,
          run: true
        }
      },
      inject: steps
    },
    tasks: {
      child: {
        properties: {
          timeout: true,
          nextStep: true,
          state: true,
          retryCount: true
        },
        on: {
          data (val) {
            if (val) {
              this.nextStep = this.root.steps.keys()[0]
              this.state = 'waiting'
            }
          }
        }
      }
    },
    define: {
      run () {
        console.log(this.status())
        this.tasks.keys().filter(key => this.tasks[key].state === 'waiting').slice(0, limit).map(key => {
          const task = this.tasks[key]
          const step = this.steps[task.nextStep]

          task.state = 'running'

          const abort = step.run(
            task,
            data => {
              clearTimeout(task.timeout)
              task.state = 'done'
              this.run()
              console.log(task.key, 'done')
            },
            error => {
              clearTimeout(task.timeout)
              task.state = 'error'
              this.run()
              console.log(task.key, 'error')
            }
          )

          task.timeout = setTimeout(() => {
            if (abort.constructor === Function) {
              abort()
            }

            task.state = 'error'
            this.run()
            console.log(task.key, 'timed out')
          }, step.timeout)
        })
      },
      status () {
        const status = { waiting: 0, running: 0, error: 0, done: 0 }
        this.tasks.each(task => status[task.state]++)
        return status
      }
    }
  })
}
