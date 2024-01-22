import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinaryService.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  /*

  Way 1 : without using the information of mongooseAggregatePaginate

  const videos = await Video.find({
    $or: [
      {
        title: {
          $regex: query,
          $options: "i",
        },
      },
      {
        description: {
          $regex: query,
          $options: "i",
        },
      },
    ],
  })
    .sort({ [sortBy]: sortType === "desc" ? -1 : 1 }) // used to sort the data which we want on basis of [sortBy] in sortType fashion and sortBy here is data item obviously
    .skip((page - 1) * limit) // skip first certain pages which we don't require (assuming user wants only under range documents from database) explicitly needs to be handle if it exceeds the range.
    .limit(limit) // give limited documents while returning
    .exec(); // execute() the whole query -- implement used to avoid something which mongodb method builder does -- lazy execution.
 
    */

  let videos = await Video.aggregate([
    {
      $match: {
        $or: [
          {
            title: {
              $regex: query,
              $options: "i",
            },
            description: {
              $regex: query,
              $options: "i",
            },
          },
        ],
      },
    },
    {
      $sort: {
        [sortBy]: sortType === "aesc" ? 1 : -1,
      },
    },
    {
      $project: {
        thumbnail: 1,
        title: 1,
        description: 1,
        duration: 1,
        views: 1,
        owner: 1,
        //   createdAt: 1,
      },
    },
  ]);

  const options = {
    page,
    limit,
  };

  videos = await Video.aggregatePaginate(videos, options);

  console.log(videos);

  return res
    .status(201)
    .json(new apiResponse(200, videos, "Videos Successfully Fetched!!"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
