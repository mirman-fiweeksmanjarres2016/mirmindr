angular.module("mirmindr")
.controller("tasksCtrl",function($scope,$mdToast,$mdDialog,$firebaseAuth,$firebaseObject,$firebaseArray){
  var ref = new Firebase("https://mirmindr.firebaseio.com");
  var authData = ref.getAuth();
  $scope.editingTask = null;
  function setUserRef(uid){
    $scope.userRef = ref.child("users").child(uid);
    $scope.authenticated = true;
    $scope.tasks = $firebaseArray($scope.userRef.child("tasks"));
    $scope.subjects = $firebaseArray($scope.userRef.child("subjects"));
    $scope.authObj = $firebaseAuth($scope.userRef);
  }
  if (authData) {
    console.log("Authenticated");
    setUserRef(authData.uid);
  }
  $scope.user = {
    email: "",
    password: ""
  };

  $scope.isOverdue = function(task) {
    // if task.done return false;
    return task.dueDate < Date.now() && ! task.done;
  };

  $scope.getOverdueTasks = function() {
    var overdue = 0;
    for(t in $scope.tasks) {
      var task = $scope.tasks[t];
      if($scope.isOverdue(task)) {
        overdue ++;
      }
    }
    if(overdue == 0) {
      return "";
    }
    return overdue;
    // Check all tasks for overdue status.
    // Return count of all overdue tasks.
    // So the badge clears, if the count is 0, should return an empty string.
  };

  $scope.updateBadge = function() {
    chrome.browserAction.setBadgeText({
      text:$scope.getOverdueTasks().toString()
    });
  };

  $scope.updateTaskIds = function(oldId, newId) {
    for (var t in $scope.tasks) {
      var task = $scope.tasks[t];
      if (task.subject == oldId) {
        task.subject = newId;
        $scope.tasks.$save(task);
      }
    }
  };

  $scope.toggleSubjects = function() {
    $scope.subjectsUp = $scope.subjectsUp ? false : true;
    // If editingSubjects is true, make it false. Or vice versa
  };

  $scope.setCurrentTask= function(task) {
    $scope.currentTask=task;
  };

  $scope.toggleAddingTask = function() {
    $scope.addingTask = $scope.addingTask ? false : true;
    // If addingTask is true, make it false. Or vice versa
  };

  $scope.toggleEditingTask = function(task) {
    $scope.editingTask = $scope.editingTask ? null : task;
    if($scope.editingTask) {
      $scope.newTask = angular.copy(task);
      $scope.newTask.dueDate= new Date($scope.newTask.dueDate);
    } else {
      $scope.newTask = {};
    }
    // If editingTask is true, make it false. Or vice versa
  };

  $scope.deleteTask = function(task) {
    // Remove task from $scope.tasks
    var confirm = $mdDialog.confirm()
    .title('Are you sure you want to delete this task?')
    .textContent('This cannot be undone.')
    .ok('Yes')
    .cancel('No');
    $mdDialog.show(confirm).then(function() {
      $scope.tasks.$remove(task);
    }, function() {
    }
  );
  $scope.updateBadge();
};

$scope.toggleDone = function(task) {
  // Mark task as done
  task.done = task.done ? false: true;
  var msg = task.name;
  // Alert with a toast
  if (task.done) {
    msg += " is done!"
  } else {
    msg += " isn't done!"
  }
  $scope.showActionToast(msg);

  // Save the task
  $scope.tasks.$save(task);
  $scope.updateBadge();
};

$scope.newTask = {};
chrome.identity.getProfileUserInfo(function(data){
  if(data.email) {
    console.log("Email found");
    $scope.user.email = data.email;
    $scope.$apply();
  }
});

if($scope.tasks){
  $scope.tasks.$loaded(function(){
    $scope.updateBadge();
  });
}

$scope.showActionToast = function(msg) {
  var toast = $mdToast.simple()
  .textContent(msg)
  .action('OK')
  .highlightAction(false)
  .position("top");
  $mdToast.show(toast);
};

$scope.showProfile = function() {
  $mdDialog.show({
    templateUrl:"app/templates/profile.html",
    clickOutsideToClose:true,
    fullscreen:false,
    scope: $scope.$new()
  });
};

$scope.login = function(form) {
  if (form.$valid) {
    ref.authWithPassword({
      email: $scope.user.email,
      password: $scope.user.password
    }, function(error, authData) {
      if(error) {
        $scope.showActionToast(error.toString());
      } else {
        setUserRef(authData.uid);
        $scope.$apply();
      }
    });
  }
};

$scope.logout = function() {
  ref.unauth();
  $scope.authenticated = false;
};

$scope.resetPassword = function() {
  ref.resetPassword({
    email: $scope.user.email
  }, function(error) {
    if (error === null) {
      $scope.showActionToast("Reset Email Sent!");
    } else {
      $scope.showActionToast("Reset Email Not Sent!");
    }
  });
};

$scope.updateProfile = function(form) {
  if(form.$valid) {
    if($scope.user.newEmail != $scope.user.email) {
      $scope.authObj.$changeEmail({
        oldEmail: $scope.user.email,
        newEmail: $scope.user.newEmail,
        password: $scope.user.password
      }).then(function() {
        console.log("Email changed successfully");
        $scope.showActionToast("Email changed!");
        $scope.user.email = $scope.user.newEmail;
      }).catch(function(error) {
        $scope.showActionToast("An error occurred, please try again");
        console.log("Error: ", error);
      });
    };
    // If p/w has changed, change the p/w
    if($scope.user.password != $scope.user.newPassword) {
      // confirm p/ws match
      if($scope.user.newPassword == $scope.user.newPasswordConfirm) {
        $scope.authObj.$changePassword({
          oldPassword: $scope.user.password,
          newPassword: $scope.user.newPassword,
          email: $scope.user.email
        }).then(function() {
          $scope.user.password = $scope.user.newPassword;
          console.log("Password changed successfully");
          $scope.showActionToast("Password changed successfully!");
        }).catch(function(error) {
          console.error("Error: ", error);
          $scope.showActionToast("An error occurred, please try again");
        });
      } else {
        $scope.showActionToast("Passwords don't match!");
      }
    }
  } else {
    $scope.showActionToast("Missing something?");
  }
};

$scope.addTask = function(form) {
  if(form.$valid) {
    $scope.newTask.done = $scope.newTask.done || false;
    if($scope.editingTask) {
      $scope.tasks.$remove($scope.editingTask);
      $scope.editingTask=null;
    }  else{
      $scope.addingTask = false;
    }
    $scope.newTask.dueDate = $scope.newTask.dueDate.getTime();
    $scope.tasks.$add($scope.newTask);
    $scope.newTask = {};
    $scope.updateBadge();
  } else {
    $scope.showActionToast("Missing something?");
  }
};
$scope.updateBadge();
});
