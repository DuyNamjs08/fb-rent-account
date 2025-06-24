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
sh """
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "source /root/.bashrc && cd ${DEPLOY_DIR} && git pull origin master && npm run prod"
"""

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
