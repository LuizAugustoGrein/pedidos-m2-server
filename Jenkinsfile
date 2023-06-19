pipeline {
  agent {
    docker {
      image 'node:20-alpine3.16'
      args '-p 3333:3333'
    }
  }
  stages {
    stage('Build') {
      steps {
        sh 'npm install'
        sh 'npm run dev'
      }
    }
  }
}