pipeline {
    agent any

    tools {
        nodejs 'Node20'
    }

    environment {
        DEPLOY_DIR = '/var/www/fb-rent-account'
        SSH_CREDENTIALS_ID = 'vps-ssh-key'
        VPS_USER = 'root'
        VPS_IP = '103.82.20.109'
    }

    stages {
        stage('Deploy') {
            steps {
                sshagent (credentials: ["${SSH_CREDENTIALS_ID}"]) {
                    sh """
                    ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "\
                    cd ${DEPLOY_DIR}; \
                    git pull origin master; \
                    npm run prod"
                    """
                }
            }
        }
    }
}
