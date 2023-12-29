import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinaryService.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // while saving other properties of model will also kick-in to avoid that we pass one more parameter say `validateBeforeSave`
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(500, "Something went wrong while generating tokens.");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty (common validation)
  // check user already exists: by username and email both
  // check for images
  // check for avatar
  // upload them cloudinary, avatar check
  // create user object -- in mongo db nosql database objects transferred
  // remove password and refresh token field from response
  // check for user creation
  // return res
  // -- or isko bolte hain logic building

  const { fullname, email, username, password } = req.body;

  console.log(req.body);

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new apiError(400, "All fields are Required!!");
  }

  const existedUser = await User.findOne({
    $or: [
      {
        username,
      },
      {
        email,
      },
    ],
  });

  if (existedUser) {
    throw new apiError(409, "User already Exists!!");
  }
  console.log(existedUser);
  console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  )
    coverImageLocalPath = req.files.coverImage[0].path;

  if (!avatarLocalPath) throw new apiError(400, "User Avatar is Required !!");

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  let coverImage = null;
  if (coverImageLocalPath)
    coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new apiError(400, "User Avatar is Required !!");

  // user uploaded to database
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // check that whether user is in database or not . ?
  const theUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // if it isn't return that the theresome server side error ..
  if (!theUser)
    throw new apiError(500, "Something went wrong while registering the user.");

  return res
    .status(201)
    .json(new apiResponse(200, theUser, "User successfully registered!!"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token generate
  // and send to user .
  // send token in cookies or secure cookies

  const { username, email, password } = req.body;

  console.log(req.body);

  if (!username && !email)
    throw new apiError(400, "username or email is required.");

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) throw new apiError(404, "User does not exist!");

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new apiError(401, "Invalid user credentials.");

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // returning to user
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // sending access and refersh token into cookies also
  // while sending cookies we have to set some options
  const options = {
    httpOnly: true,
    secure: true,
  };
  // both parameter allow cookies to be modified from the server only as by default can be modified from frontend also

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully !"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // clear cookies
  // reset refresh token

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "Logged Out Successfully !!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // need the refresh token
  // khn se aayega
  // cookies se access kar skte hain
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  console.log(incomingRefreshToken);

  if (!incomingRefreshToken) throw new apiError(401, "Unauthorized request !!");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    console.log(decodedToken);

    const user = await User.findById(decodedToken?._id);

    if (!user) throw new apiError(401, "Invalid refersh token !!");

    if (incomingRefreshToken !== user.refreshToken)
      throw new apiError(401, "Refresh token is expired !!");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );
    console.log(accessToken, refreshToken);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new apiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "Access Token Refreshed !!"
        )
      );
  } catch (error) {
    throw new apiError(401, error.message || "Invalid Refresh Token !!");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) throw new apiError(400, "Invalid Old Password !!");

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new apiResponse(200, req.user, "Current user fetched successfully !!")
    );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email)
    throw new apiError(400, "All fields are required !!");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true } // return the new updated value also
  ).select("-password");

  return res
    .status(200)
    .json(
      new apiResponse(200, user, "Account details successfully updated !!")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) throw new apiError(400, "Avatar file is missing");

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) throw new apiError(401, "Avatar File Uploading Error !!");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  // TODO : delete old avatar image

  return res
    .status(200)
    .json(new apiResponse(200, user, "Avatar file Updated successfully !!"));
});

const UpdateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) throw new apiError(400, "CoverImage is missing !!");

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url)
    throw new apiError(401, "CoverImage File Uploading Error !!");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  // TODO : Delete old cover image

  return res
    .status(200)
    .json(new apiResponse(200, user, "Cover Image Updated Successfully !!"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new apiError(400, "Username is missing in params !!");
  }

  const channel = await User.aggregate([
    // stage - 1 : match..
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    // stage - 2 : take object as values using lookup for getting all subscribers of the channel
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    // stage - 3 : use lookup to get all the channel whole subscriber is subscribing
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    // stage - 4 : add both the fields (subscriberCount & channelSubscribedToCount) also for the case that the channel is already subscribed by user or not .. we have to check that also to alter the state of subscriber field ..
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscibers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true, // on true after if 'then' calls
            else: false, // on false after if 'else' calls
          },
        },
      },
    },
    // stage - 5 : we don't have to send all the values to the client which increase data traffic for that we  are only sending the selected fields only ..
    {
      $project: {
        fullname: 1,
        username: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) throw new apiError(400, "Channel doesn't exists !!");

  console.log(channel);

  return res
    .status(200)
    .json(
      new apiResponse(200, channel[0], "User Channel fetched Successfully")
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  UpdateUserCoverImage,
  getUserChannelProfile,
};
