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
                    script {
                       def sshCommand = "ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} " +
    "\"export NVM_DIR='/root/.nvm'; " +
    "[ -s '\$NVM_DIR/nvm.sh' ] && . '\$NVM_DIR/nvm.sh'; " +
    "export PATH='\$NVM_DIR/versions/node/v20.16.0/bin:\$PATH'; " +
    "cd ${DEPLOY_DIR}; " +
    "git pull origin master; " +
    "npm run prod\""
                        sh sshCommand
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline hoàn tất."
        }
        success {
            echo "Deploy thành công trên branch master!"
        }
        failure {
            echo "Pipeline thất bại. Vui lòng kiểm tra log để biết chi tiết."
        }
    }
}
