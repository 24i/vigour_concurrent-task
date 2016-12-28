'use strict'

const { create } = require('brisky-struct')

module.exports = (limit) => {
  return create({
    steps: {
      props: {
        default: {
          props: {
            timeout: true,
            tryCount: true,
            run: true
          },
          timeout: 1000,
          tryCount: 1
        }
      }
    },
    tasks: {
      props: {
        default: {
          props: {
            timeout: true,
            step: true,
            state: true,
            tryCount: true,
            abort: true
          },
          step: 0,
          tryCount: 0,
          state: 'waiting',
          abort: false,
          define: {
            clear () {
              if (this.get('timeout')) {
                clearTimeout(this.get('timeout'))
              }
              if (this.get('state') === 'running' && this.get('abort')) {
                this.get('abort')()
              }
            },
            completeStep (data, stepKey) {
              if (this.get('state') !== 'running') {
                return
              }
              this.clear()
              if (data !== undefined && data !== null) {
                this.set({[stepKey]: data})
              }
              this.set({step: this.get('step') + 1})
              this.tryCount = 0
              if (this.get('step') >= this.root().get('steps').keys().length) {
                this.root().emit('task-done', this.key)
                this.set({ state: 'done' })
              } else {
                this.set({ state: 'waiting' })
              }
            },
            error (error) {
              if (this.get('state') !== 'running') {
                return
              }
              this.clear()
              if (!error) {
                error = new Error('Unknown Error')
              }
              this.root().emit('error', this.key, error)
              this.set({ state: 'error' })
              this.set({ tryCount: this.get('tryCount') + 1 })
            }
          },
          on: {
            remove () {
              this.clear()
            }
          }
        }
      }
    },
    props: {
      immediate: true
    },
    define: {
      debounceRun () {
        if (this.get('immediate')) {
          clearImmediate(this.get('immediate'))
        }
        this.set({ immediate: setImmediate(this.run.bind(this)) })
      },
      run () {
        var running = 0

        if (!this.get('tasks')) {
          return this.emit('complete')
        }

        const toRun = this.get('tasks').filter(task => {
          const thisStep = task.get('step')
          const stepKey = this.get('steps').keys()[thisStep]
          const step = this.get([ 'steps', stepKey ])

          if (task.get('state') === 'running') {
            running++
          }

          return task.get('state') === 'waiting' || (step && task.get('state') === 'error' && task.get('tryCount') < step.get('tryCount'))
        })

        if (toRun.length < 1) {
          if (running < 1) {
            this.emit('complete')
          }
          return
        }

        toRun.slice(0, limit - running).forEach(task => {
          const thisStep = task.get('step')
          const stepKey = this.get('steps').keys()[thisStep]
          const step = this.get([ 'steps', stepKey ])

          task.set({ state: 'running' })

          task.set({ timeout: setTimeout(() => {
            if (task.get('step') !== thisStep) {
              return
            }
            if (task.get('abort')) {
              task.get('abort')()
            }
            task.error(new Error(`Timed out on step ${step.key}`))
            this.debounceRun()
          }, step.get('timeout')) })

          task.set({ abort: step.run(
            task,
            data => {
              if (task.get('step') !== thisStep) {
                return
              }
              task.completeStep(data, step.key)
              this.debounceRun()
            },
            error => {
              if (task.get('step') !== thisStep) {
                return
              }
              task.error(error)
              this.debounceRun()
            }
          ) })
        })
      },
      status () {
        return this.get('tasks').reduce((status, task) => {
          status[task.get('state')]++
          return status
        }, { waiting: 0, running: 0, error: 0, done: 0 })
      }
    }
  })
}
